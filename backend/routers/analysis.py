"""
ParaPusula - Analiz Router
Kullanıcının finansal snapshot ve sağlık skorunu döndüren endpoint'ler.
"""

from datetime import datetime
from fastapi import APIRouter, HTTPException
from services.firebase_service import firebase_service
from services.gemini_service import gemini_service
from agents.analiz_agent import finansal_skor_hesapla, borc_siniflandir

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
        tcmb = ham.get("tcmb_verisi") or {"azami_faiz": 4.5, "kfe": 34.0, "tufe": 65.0, "asgari_ucret": 22104.0}
        gelir = float(ham.get("gelir", 0))
        gider = float(ham.get("toplam_gider", 0))

        # ── Borçları yeniden sınıflandır ──────────────────────
        print(f"[RECALCULATE] TCMB verisi: kfe={tcmb.get('kfe')}, azami_faiz={tcmb.get('azami_faiz')}")
        yeni_borclar = []
        for borc in ham.get("borc_listesi", []):
            aciklama = borc.get("aciklama", "")
            aylik_odeme = float(borc.get("aylik_odeme", 0))
            sinif_bilgi = borc_siniflandir(aciklama, aylik_odeme, tcmb)
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
