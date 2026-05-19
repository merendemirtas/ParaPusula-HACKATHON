"""
ParaPusula - Analiz Router
Kullanıcının finansal snapshot ve sağlık skorunu döndüren endpoint'ler.
"""

from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.firebase_service import firebase_service
from services.gemini_service import gemini_service
from agents.analiz_agent import finansal_skor_hesapla, borc_siniflandir, borc_cikis_plani_hesapla

router = APIRouter()


@router.get("/analysis/{user_id}")
async def kullanici_analizi_getir(user_id: str):
    """
    Kullanıcının en son finansal snapshot'ını döndürür.
    Ham Firestore dict'i döndürür — oneriler dahil tüm alanlar korunur.
    """
    try:
        snapshot = await firebase_service.son_snapshot_oku(user_id)

        if snapshot is None:
            raise HTTPException(
                status_code=404,
                detail=f"'{user_id}' için henüz finansal analiz bulunamadı. PDF yükleyin."
            )

        # model_dump() + ham Firestore verilerini birleştir
        # (oneriler, borc_cikis_plani gibi ekstra alanlar için)
        sonuc = snapshot.model_dump()

        # Ham Firestore'dan oneriler oku (model içinde varsa override etme)
        try:
            ham = await firebase_service.snapshot_ham_oku(user_id, snapshot.ay)
            if ham:
                if ham.get("oneriler"):
                    sonuc["oneriler"] = ham["oneriler"]
                if ham.get("borc_cikis_plani"):
                    sonuc["borc_cikis_plani"] = ham["borc_cikis_plani"]
        except Exception:
            pass  # Ham okuma başarısız olursa model verisiyle devam et

        return sonuc

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analiz verisi getirme hatası: {e}")


@router.get("/health-score/{user_id}")
async def finansal_skor_getir(user_id: str):
    """
    Kullanıcının finansal sağlık skorunu döndürür (0-100).
    0-40: Kritik | 41-60: Dikkat | 61-80: İyi | 81-100: Mükemmel
    """
    try:
        snapshot = await firebase_service.son_snapshot_oku(user_id)

        if snapshot is None:
            raise HTTPException(
                status_code=404,
                detail=f"'{user_id}' için henüz skor hesaplanmadı."
            )

        skor = snapshot.finansal_skor

        if skor >= 81:
            etiket, yorum = "Mükemmel", "Mükemmel finansal sağlık! Sürdürmeye devam edin."
        elif skor >= 61:
            etiket, yorum = "İyi", "İyi gidiyorsunuz. Birkaç iyileştirme ile harika olabilir."
        elif skor >= 41:
            etiket, yorum = "Dikkat", "Dikkat gerektiren noktalar var. Önerilere göz atın."
        else:
            etiket, yorum = "Kritik", "Acil aksiyon gerekiyor. Önerileri mutlaka uygulayın."

        return {
            "user_id": user_id,
            "finansal_skor": skor,
            "etiket": etiket,
            "ay": snapshot.ay,
            "yorum": yorum,
            "gelir": snapshot.gelir,
            "toplam_gider": snapshot.toplam_gider,
            "nakit_akisi": snapshot.nakit_akisi
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sağlık skoru getirme hatası: {e}")


@router.post("/recalculate/{user_id}")
async def yeniden_hesapla(user_id: str):
    """
    Mevcut Firestore snapshot'ını yeni algoritmayla yeniden hesaplar:
    - Finansal skoru yeni kurallara göre düzeltir
    - Borçları TCMB verisiyle yeniden sınıflandırır
    - Gemini ile taze öneri üretir
    - Hepsini Firestore'a yazar

    PDF yeniden yüklemeye gerek kalmadan güncel sonuç verir.
    """
    try:
        # ── En son snapshot'ı ham dict olarak oku ─────────────
        snapshot = await firebase_service.son_snapshot_oku(user_id)
        if not snapshot:
            raise HTTPException(status_code=404, detail="Önce PDF yükleyin.")

        ay = snapshot.ay
        ham = await firebase_service.snapshot_ham_oku(user_id, ay)
        if not ham:
            raise HTTPException(status_code=404, detail="Snapshot verisi okunamadı.")

        print(f"[RECALCULATE] Başlıyor — user: {user_id}, ay: {ay}")
        print(f"[RECALCULATE] Mevcut skor: {ham.get('finansal_skor')}")

        kategoriler = ham.get("kategoriler", [])
        # Firestore tcmb_cache'ten güncel TÜFE/KFE oku
        _tcmb_cache = None
        try:
            _tcmb_cache = await firebase_service.tcmb_cache_oku()
        except Exception:
            pass
        tcmb = _tcmb_cache.model_dump() if _tcmb_cache else (
            ham.get("tcmb_verisi") or {"azami_faiz": 5.1, "kfe": 34.0, "tufe": 30.65}
        )
        gelir = float(ham.get("gelir", 0))
        gider = float(ham.get("toplam_gider", 0))

        # ── Borçları yeniden sınıflandır ──────────────────────
        print(f"[RECALCULATE] Sınıflandırmada kullanılan TÜFE: %{tcmb.get('tufe')}")
        print(f"[RECALCULATE] Sınıflandırmada kullanılan KFE:  %{tcmb.get('kfe')}")
        yeni_borclar = []
        for borc in ham.get("borc_listesi", []):
            aciklama = borc.get("aciklama", "")
            sinif_bilgi = borc_siniflandir(aciklama, tcmb)
            yeni_borc = dict(borc)
            yeni_borc["siniflandirma"] = sinif_bilgi["siniflandirma"]
            yeni_borc["faiz_orani"] = sinif_bilgi["faiz_orani"]
            print(f"[RECALCULATE] Borç: '{aciklama[:30]}' → {sinif_bilgi['siniflandirma']}")
            yeni_borclar.append(yeni_borc)

        # ── Skoru yeniden hesapla ──────────────────────────────
        yeni_skor = finansal_skor_hesapla(
            toplam_gelir=gelir,
            toplam_gider=gider,
            borc_listesi=yeni_borclar,
            kategoriler=kategoriler
        )
        print(f"[RECALCULATE] Yeni skor: {yeni_skor} (eski: {ham.get('finansal_skor')})")

        # ── Gemini ile taze öneri üret ─────────────────────────
        oneriler = []
        borc_cikis_plani = None
        try:
            profil_obj = await firebase_service.kullanici_profil_oku(user_id)
            profil = profil_obj.model_dump() if profil_obj else None

            guncel_snapshot = dict(ham)
            guncel_snapshot["finansal_skor"] = yeni_skor
            guncel_snapshot["borc_listesi"] = yeni_borclar

            oneri_sonucu = await gemini_service.oneri_uret(
                snapshot=guncel_snapshot,
                profil=profil,
                tcmb=tcmb
            )
            oneriler = oneri_sonucu.get("oneriler", [])
            borc_cikis_plani = oneri_sonucu.get("borc_cikis_plani")
            # Ay-ay adımları deterministik üret
            if yeni_borclar:
                ekstra = float((borc_cikis_plani or {}).get("aylik_ekstra_odeme", 0)) or 1000
                borc_cikis_plani = borc_cikis_plani_hesapla(yeni_borclar, ekstra, max_ay=24)
                print(f"[RECALCULATE] Borç çıkış planı: {len(borc_cikis_plani['adimlar'])} adım üretildi")
            print(f"[RECALCULATE] {len(oneriler)} öneri üretildi ✓")
        except Exception as oneri_hata:
            print(f"[RECALCULATE] Öneri üretme hatası (devam ediliyor): {oneri_hata}")

        # ── Firestore'a yaz ────────────────────────────────────
        guncellemeler = {
            "finansal_skor": yeni_skor,
            "borc_listesi": yeni_borclar,
            "oneriler": oneriler,
            "borc_cikis_plani": borc_cikis_plani,
            "yeniden_hesaplama_tarihi": datetime.now().isoformat()
        }
        await firebase_service.snapshot_guncelle(user_id, ay, guncellemeler)
        print(f"[RECALCULATE] Firestore güncellendi ✓")

        return {
            "basarili": True,
            "ay": ay,
            "eski_skor": ham.get("finansal_skor"),
            "yeni_skor": yeni_skor,
            "oneri_sayisi": len(oneriler),
            "borc_siniflandirma": {b.get("aciklama", "?")[:30]: b.get("siniflandirma") for b in yeni_borclar}
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[RECALCULATE] KRİTİK HATA:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Yeniden hesaplama hatası: {e}")


class BorcFaizIstek(BaseModel):
    borc_adi: str
    faiz_yillik: float


@router.put("/borc-faiz/{user_id}")
async def borc_faiz_guncelle(user_id: str, istek: BorcFaizIstek):
    """
    Kullanıcının manuel girdiği faiz oranını kaydeder ve snapshot'taki
    ilgili borcu günceller (siniflandirma + faiz_orani).
    """
    try:
        if istek.faiz_yillik <= 0 or istek.faiz_yillik > 500:
            raise HTTPException(status_code=400, detail="Faiz oranı 0-500 arasında olmalı.")

        print(f"\n[BORC-FAIZ] Faiz güncellendi, reanalyze başlıyor...")
        print(f"[BORC-FAIZ] Borç: '{istek.borc_adi[:40]}', Faiz: %{istek.faiz_yillik}")

        # 1. borc_detaylari'na kaydet
        await firebase_service.borc_faiz_kaydet(user_id, istek.borc_adi, istek.faiz_yillik)

        # 2. Son snapshot'ı oku ve ilgili borcu güncelle
        snap = await firebase_service.son_snapshot_oku(user_id)
        if not snap:
            return {"basarili": True, "borc_adi": istek.borc_adi, "faiz_yillik": istek.faiz_yillik,
                    "guncellenen_borclar": []}

        ham = await firebase_service.snapshot_ham_oku(user_id, snap.ay)
        if not ham:
            return {"basarili": True, "borc_adi": istek.borc_adi, "faiz_yillik": istek.faiz_yillik,
                    "guncellenen_borclar": []}

        # KARAR: Snapshot içindeki tcmb_verisi PDF işleme anındaki değer — eski olabilir.
        # Firestore tcmb_cache'ten güncel veriyi oku; başarısız olursa snapshot'a düş.
        tcmb_cache = None
        try:
            tcmb_cache = await firebase_service.tcmb_cache_oku()
        except Exception:
            pass
        if tcmb_cache:
            tcmb = tcmb_cache.model_dump()
        else:
            tcmb = ham.get("tcmb_verisi") or {"azami_faiz": 5.1, "kfe": 34.0, "tufe": 30.65}
        print(f"[BORC-FAIZ] Sınıflandırmada kullanılan TÜFE: %{tcmb.get('tufe')}")
        print(f"[BORC-FAIZ] Sınıflandırmada kullanılan KFE:  %{tcmb.get('kfe')}")

        gelir      = float(ham.get("gelir", 0))
        gider      = float(ham.get("toplam_gider", 0))
        kategoriler = ham.get("kategoriler", [])
        borclar    = ham.get("borc_listesi", [])

        print(f"[BORC-FAIZ] Snapshot borçları: {[b.get('aciklama','?')[:25] for b in borclar]}")

        guncellendi = False
        for b in borclar:
            # KARAR: strip() ile baştaki/sondaki boşluk farkını tolere et
            if b.get("aciklama", "").strip() == istek.borc_adi.strip():
                eski_sinif = b.get("siniflandirma", "?")
                sinif_bilgi = borc_siniflandir(
                    aciklama=istek.borc_adi,
                    tcmb=tcmb,
                    faiz_manuel=istek.faiz_yillik,
                )
                b["faiz_orani"]    = sinif_bilgi["faiz_orani"]
                b["siniflandirma"] = sinif_bilgi["siniflandirma"]
                guncellendi = True
                print(f"[BORC-FAIZ] '{istek.borc_adi[:30]}' yeni sınıf: {sinif_bilgi['siniflandirma']} "
                      f"(eski: {eski_sinif})")

        if not guncellendi:
            print(f"[BORC-FAIZ] UYARI: '{istek.borc_adi}' snapshot'ta bulunamadı — "
                  f"sadece borc_detaylari güncellendi")

        yeni_skor = finansal_skor_hesapla(
            toplam_gelir=gelir,
            toplam_gider=gider,
            borc_listesi=borclar,
            kategoriler=kategoriler,
        )
        await firebase_service.snapshot_guncelle(user_id, snap.ay, {
            "borc_listesi":  borclar,
            "finansal_skor": yeni_skor,
        })
        print(f"[BORC-FAIZ] Firestore güncellendi ✓  Yeni skor: {yeni_skor}/100\n")

        # Frontend'in re-fetch yapmadan güncel veriyi kullanabilmesi için dön
        return {
            "basarili":          True,
            "borc_adi":          istek.borc_adi,
            "faiz_yillik":       istek.faiz_yillik,
            "guncellenen_borclar": borclar,
            "yeni_finansal_skor": yeni_skor,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Faiz güncelleme hatası: {e}")


@router.post("/reanalyze/{user_id}")
async def yeniden_analiz_et(user_id: str):
    """
    Mevcut snapshot'taki borçları güncellenmiş sınıflandırma kurallarıyla
    yeniden analiz eder. PDF yüklemeden, Gemini çağrısı olmadan çalışır.

    Yapılanlar:
    1. Firestore snapshot oku
    2. borc_siniflandir() yeni kurallarla yeniden çalıştır
    3. finansal_skor_hesapla() ile skoru güncelle
    4. Firestore'a yaz
    5. Değişen sınıflandırmaları rapor et
    """
    try:
        snapshot = await firebase_service.son_snapshot_oku(user_id)
        if not snapshot:
            raise HTTPException(status_code=404, detail="Önce PDF yükleyin.")

        ay  = snapshot.ay
        ham = await firebase_service.snapshot_ham_oku(user_id, ay)
        if not ham:
            raise HTTPException(status_code=404, detail="Snapshot verisi okunamadı.")

        # Firestore tcmb_cache'ten güncel TÜFE/KFE oku
        tcmb_cache = None
        try:
            tcmb_cache = await firebase_service.tcmb_cache_oku()
        except Exception:
            pass
        if tcmb_cache:
            tcmb = tcmb_cache.model_dump()
        else:
            tcmb = ham.get("tcmb_verisi") or {"azami_faiz": 5.1, "kfe": 34.0, "tufe": 30.65}
        print(f"[REANALYZE] Sınıflandırmada kullanılan TÜFE: %{tcmb.get('tufe')}")
        print(f"[REANALYZE] Sınıflandırmada kullanılan KFE:  %{tcmb.get('kfe')}")

        gelir = float(ham.get("gelir", 0))
        gider = float(ham.get("toplam_gider", 0))
        kategoriler = ham.get("kategoriler", [])

        degisimler = []
        yeni_borclar = []

        # Manuel faiz girişlerini çek — reanalyze'da da kullanılsın
        borc_detaylari = {}
        try:
            borc_detaylari = await firebase_service.borc_detaylari_oku(user_id)
        except Exception:
            pass

        for borc in ham.get("borc_listesi", []):
            eski_sinif = borc.get("siniflandirma", "?")
            aciklama   = borc.get("aciklama", "")
            sinif_bilgi = borc_siniflandir(
                aciklama=aciklama,
                tcmb=tcmb,
                faiz_manuel=borc_detaylari.get(aciklama),
            )
            yeni_sinif = sinif_bilgi["siniflandirma"]
            yeni_borc  = dict(borc)
            yeni_borc["siniflandirma"] = yeni_sinif
            yeni_borc["faiz_orani"]    = sinif_bilgi["faiz_orani"]
            yeni_borclar.append(yeni_borc)

            if eski_sinif != yeni_sinif:
                degisimler.append({
                    "aciklama": borc.get("aciklama", "?")[:40],
                    "eski":     eski_sinif,
                    "yeni":     yeni_sinif,
                })
                print(f"[REANALYZE] '{borc.get('aciklama','')[:30]}': {eski_sinif} → {yeni_sinif}")

        yeni_skor = finansal_skor_hesapla(
            toplam_gelir=gelir,
            toplam_gider=gider,
            borc_listesi=yeni_borclar,
            kategoriler=kategoriler,
        )

        await firebase_service.snapshot_guncelle(user_id, ay, {
            "borc_listesi":         yeni_borclar,
            "finansal_skor":        yeni_skor,
            "yeniden_analiz_tarihi": datetime.now().isoformat(),
        })

        print(f"[REANALYZE] Tamamlandı — {len(degisimler)} borç sınıfı değişti, skor: {yeni_skor}")

        return {
            "basarili":       True,
            "ay":             ay,
            "yeni_skor":      yeni_skor,
            "eski_skor":      ham.get("finansal_skor"),
            "degisimler":     degisimler,
            "degisim_sayisi": len(degisimler),
            "toplam_borc":    len(yeni_borclar),
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[REANALYZE] HATA:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Yeniden analiz hatası: {e}")


@router.get("/snapshots/{user_id}/trend")
async def gider_trend_getir(user_id: str):
    """
    Son 3 aya ait gider/gelir verisi döndürür.
    Her zaman 3 slot döner — veri olmayan aylar null değerli.
    Recharts connectNulls={false} ile eksik aylar grafik üstünde boş bırakılır.
    """
    from datetime import date as _date
    AY_KISALT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
    AY_TAM    = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

    today = _date.today()

    # 3 ay slot oluştur: 2 ay önce → 1 ay önce → bu ay
    slots = []
    for i in range(2, -1, -1):
        month = today.month - i
        year  = today.year
        while month <= 0:
            month += 12
            year  -= 1
        ay_str = f"{year}-{month:02d}"
        slots.append({
            "ay":           ay_str,
            "ay_kisalt":    f"{AY_KISALT[month-1]} {str(year)[2:]}",
            "ay_tam":       f"{AY_TAM[month-1]} {year}",
            "toplam_gider": None,   # null → Recharts çizgi çizmez
            "gelir":        None,
            "finansal_skor": None,
        })

    # Mevcut snapshot'ları çekip slot'lara yerleştir
    try:
        snapshots = await firebase_service.snapshot_listesi_oku(user_id, limit=3)
        snap_map  = {s.get("ay", ""): s for s in snapshots}
        for slot in slots:
            s = snap_map.get(slot["ay"])
            if s:
                slot["toplam_gider"]  = round(float(s.get("toplam_gider", 0)), 2)
                slot["gelir"]         = round(float(s.get("gelir", 0)), 2)
                slot["finansal_skor"] = int(s.get("finansal_skor", 0))
    except Exception:
        pass  # Hata olursa null slotlarla devam

    return {"user_id": user_id, "veri": slots}


@router.get("/comparison/{user_id}")
async def aylik_karsilastirma_getir(user_id: str):
    """
    Bu ay ve geçen ayın snapshot'larını karşılaştırır.
    Delta hesaplamaları döndürür: skor, gider, kategori değişimleri, borç.
    Geçen ay yoksa 404 yerine {"onceki_ay": null} döner.
    """
    try:
        snapshots = await firebase_service.snapshot_listesi_oku(user_id, limit=2)

        if not snapshots:
            raise HTTPException(status_code=404, detail="Karşılaştırma için veri bulunamadı.")

        bu_ay = snapshots[0]
        onceki_ay = snapshots[1] if len(snapshots) > 1 else None

        if not onceki_ay:
            return {"bu_ay": bu_ay.get("ay"), "onceki_ay": None, "delta": None}

        # ── Skor değişimi ─────────────────────────────────────
        skor_bu    = float(bu_ay.get("finansal_skor", 0))
        skor_once  = float(onceki_ay.get("finansal_skor", 0))
        skor_delta = skor_bu - skor_once

        # ── Gider değişimi ────────────────────────────────────
        gider_bu   = float(bu_ay.get("toplam_gider", 0))
        gider_once = float(onceki_ay.get("toplam_gider", 0))
        gider_pct  = ((gider_bu - gider_once) / gider_once * 100) if gider_once > 0 else 0

        # ── Kategori değişimleri ──────────────────────────────
        def kat_map(snapshot):
            return {
                k.get("kategori_adi", ""): abs(float(k.get("toplam_tutar", 0)))
                for k in snapshot.get("kategoriler", [])
                if k.get("toplam_tutar", 0) < 0 and abs(float(k.get("toplam_tutar", 0))) > 50
            }

        kat_bu    = kat_map(bu_ay)
        kat_once  = kat_map(onceki_ay)

        degisimler = []
        for adi, tutar_bu in kat_bu.items():
            if adi in kat_once and kat_once[adi] > 0:
                pct = (tutar_bu - kat_once[adi]) / kat_once[adi] * 100
                if abs(pct) >= 5:
                    degisimler.append({"kategori": adi, "pct": round(pct, 1),
                                       "bu_ay": tutar_bu, "onceki_ay": kat_once[adi]})

        degisimler.sort(key=lambda x: x["pct"])
        en_az_artan  = degisimler[-1] if degisimler else None  # en yüksek artış (kötü)
        en_cok_azalan = degisimler[0] if degisimler else None  # en yüksek düşüş (iyi)

        # ── Borç değişimi ─────────────────────────────────────
        borc_bu   = sum(float(b.get("ana_para", 0)) for b in bu_ay.get("borc_listesi", []))
        borc_once = sum(float(b.get("ana_para", 0)) for b in onceki_ay.get("borc_listesi", []))
        borc_odenen = borc_once - borc_bu if borc_once > borc_bu else 0
        borc_pct    = ((borc_once - borc_bu) / borc_once * 100) if borc_once > 0 else 0

        return {
            "bu_ay":    bu_ay.get("ay"),
            "onceki_ay": onceki_ay.get("ay"),
            "delta": {
                "skor_bu":    round(skor_bu),
                "skor_once":  round(skor_once),
                "skor_delta": round(skor_delta, 1),
                "gider_bu":   round(gider_bu, 2),
                "gider_once": round(gider_once, 2),
                "gider_pct":  round(gider_pct, 1),
                "en_cok_artan":  en_az_artan,
                "en_cok_azalan": en_cok_azalan,
                "kat_degisimleri": degisimler,
                "borc_bu":     round(borc_bu, 2),
                "borc_once":   round(borc_once, 2),
                "borc_odenen": round(borc_odenen, 2),
                "borc_pct":    round(borc_pct, 1),
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Karşılaştırma hatası: {e}")


@router.get("/subscriptions/{user_id}")
async def abonelik_puanlari_getir(user_id: str):
    """Kullanıcının abonelik puanlarını döndürür."""
    try:
        puanlar = await firebase_service.abonelik_puanlari_oku(user_id)
        return {"user_id": user_id, "puanlar": puanlar}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Abonelik puanları getirme hatası: {e}")


@router.post("/subscriptions/{user_id}")
async def abonelik_puani_kaydet(user_id: str, data: dict):
    """
    Abonelik kullanım puanını kaydeder.
    Body: {"adi": "Netflix", "puan": 3, "tutar": 219.0}
    """
    try:
        adi   = str(data.get("adi", ""))
        puan  = int(data.get("puan", 0))
        tutar = float(data.get("tutar", 0))

        if not adi or not (1 <= puan <= 5):
            raise HTTPException(status_code=400, detail="Geçersiz abonelik adı veya puan (1-5).")

        await firebase_service.abonelik_puani_kaydet(user_id, adi, puan, tutar)
        return {"basarili": True, "adi": adi, "puan": puan}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Puan kaydetme hatası: {e}")
