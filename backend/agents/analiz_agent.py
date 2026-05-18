"""
ParaPusula - Analiz Agent
LangGraph pipeline'ının dördüncü adımı: finansal analiz yapar ve snapshot oluşturur.

Finansal skor deterministik ağırlıklı algoritmayla hesaplanır (AI değil):
- Nakit akışı pozitif mi?        → 30 puan
- Borç/gelir oranı < %40?        → 25 puan
- Abonelik < gelirin %5'i?       → 15 puan
- Kötü borç yok mu?              → 20 puan
- Düzenli gelir var mı?          → 10 puan
"""

from datetime import datetime
from models.schemas import (
    PipelineState, FinancialSnapshot, Category,
    Transaction, DebtItem, TCMBData
)
from services.firebase_service import firebase_service


def finansal_skor_hesapla(
    toplam_gelir: float,
    toplam_gider: float,
    borc_listesi: list,
    kategoriler: list
) -> int:
    """
    Deterministik ağırlıklı algoritmaya göre 0-100 arası finansal skor üretir.

    Args:
        toplam_gelir: Aylık toplam gelir (TL)
        toplam_gider: Aylık toplam gider (TL)
        borc_listesi: Borç kalemleri listesi
        kategoriler: Kategorili harcamalar

    Returns:
        int: 0-100 arası finansal sağlık skoru
    """
    nakit_akisi = toplam_gelir - toplam_gider
    nakit_negatif = nakit_akisi < 0
    skor = 0

    # ── 30 puan: Nakit akışı pozitif mi? ─────────────────────
    if nakit_akisi > 0:
        skor += 30
    # Negatif nakit akışında 0 puan — kısmi puan yok

    # ── 25 puan: Borç/gelir oranı < %40? ─────────────────────
    aylik_borc_odemesi = sum(float(b.get("aylik_odeme", 0)) for b in borc_listesi)
    if toplam_gelir > 0:
        borc_oran = aylik_borc_odemesi / toplam_gelir
        if borc_oran < 0.40:
            skor += 25
        elif borc_oran < 0.60:
            skor += 10
        # %60 üzeri: 0 puan

    # ── 15 puan: Abonelik harcaması gelirin %5'inden az mı? ──
    abonelik_tutar = sum(
        abs(float(k.get("toplam_tutar", 0)))
        for k in kategoriler
        if k.get("abonelik_mi", False)
    )
    if toplam_gelir > 0:
        abonelik_oran = abonelik_tutar / toplam_gelir
        if abonelik_oran < 0.05:
            skor += 15
        elif abonelik_oran < 0.10:
            skor += 7

    # ── 20 puan: Kritik borç yok mu? ─────────────────────────
    kotu_borc_sayisi = sum(1 for b in borc_listesi if b.get("siniflandirma") in ("kritik", "kotu"))
    if kotu_borc_sayisi == 0:
        skor += 20
    elif kotu_borc_sayisi == 1:
        skor += 8

    # ── 10 puan: Düzenli gelir var mı? ───────────────────────
    if toplam_gelir > 0:
        skor += 10

    # Nakit akışı negatifse tavan 60 — ne kadar iyi giderse gitsin
    if nakit_negatif:
        skor = min(skor, 60)

    return max(0, min(100, skor))


def borc_siniflandir(
    aciklama: str,
    aylik_odeme: float,
    tcmb: dict
) -> dict:
    """
    Borç kalemini TCMB verisiyle sınıflandırır.

    Kural:
    - Açıklamada "konut" / "mortgage" / "ev kredisi" geçiyorsa:
        faiz tahmini < KFE ise "stratejik", değilse "gri"
    - Diğerleri:
        azami_faiz * 0.8 eşiğini aştığı tahmin ediliyorsa "kotu", değilse "gri"

    # KARAR: Gerçek faiz oranı ekstreden çıkarılamadığından
    # açıklama içeriğine ve aylık ödeme büyüklüğüne göre kaba tahmin yapıyoruz.
    """
    azami_faiz = tcmb.get("azami_faiz", 4.5)

    aciklama_kucuk = aciklama.lower()

    # Konut / mortgage kredisi — stratejik borç adayı
    konut_anahtar = [
        "konut", "mortgage", "ev kredisi", "housing", "mesken",
        "konut kr", "konut krd", "housing loan"
    ]
    if any(k in aciklama_kucuk for k in konut_anahtar):
        # Konut kredisi faiz < KFE ise değer yaratan borç → stratejik
        if aylik_odeme < 15000:
            return {"siniflandirma": "stratejik", "faiz_orani": 2.5}
        else:
            return {"siniflandirma": "yonetilebilir", "faiz_orani": 3.5}

    # Kredi kartı / nakit avans / yüksek faizli tüketici — kritik borç
    kritik_anahtar = [
        "kredi karti", "kredi kartı", "credit card", "nakit avans",
        "tuketici", "tüketici", "kk borç", "kk borc",
        "kart borç", "kart borc", "limit", "avans"
    ]
    if any(k in aciklama_kucuk for k in kritik_anahtar):
        return {"siniflandirma": "kritik", "faiz_orani": azami_faiz}

    # Taşıt / araç kredisi — yönetilebilir borç
    tasit_anahtar = [
        "tasit", "taşıt", "arac", "araç", "otomobil", "vehicle", "auto"
    ]
    if any(k in aciklama_kucuk for k in tasit_anahtar):
        return {"siniflandirma": "yonetilebilir", "faiz_orani": 3.8}

    # İhtiyaç kredisi — yüksek ödemeyse kritik, değilse yönetilebilir
    ihtiyac_anahtar = [
        "ihtiyac", "ihtiyaç", "bireysel", "personal", "taksit"
    ]
    if any(k in aciklama_kucuk for k in ihtiyac_anahtar):
        if aylik_odeme > 5000:
            return {"siniflandirma": "kritik", "faiz_orani": azami_faiz}
        return {"siniflandirma": "yonetilebilir", "faiz_orani": 3.5}

    # Varsayılan: yönetilebilir borç
    return {"siniflandirma": "yonetilebilir", "faiz_orani": 3.0}


def borc_cikis_plani_hesapla(
    borc_listesi: list,
    aylik_ekstra_odeme: float,
    max_ay: int = 60
) -> dict:
    """
    Avalanche yöntemiyle aylık borç ödeme planı üretir.

    Algoritma:
    1. Borçları faiz oranına göre büyükten küçüğe sırala
    2. Her ay her borca minimum (aylık_odeme) öde
    3. Ekstra ödeme her zaman en yüksek faizli aktif borca gider
    4. Bir borç bitince ödemesi sıradaki en yüksek faizliye eklenir

    Args:
        borc_listesi: [{"aciklama","ana_para","faiz_orani","aylik_odeme",...}, ...]
        aylik_ekstra_odeme: Minimum ödemenin üzerine yapılacak ek aylık ödeme
        max_ay: En fazla kaç ay simüle edilsin (default 60 = 5 yıl)

    Returns:
        {"yontem": "avalanche", "toplam_borc": X, "aylik_ekstra_odeme": Y,
         "tahmini_bitis_ay": "YYYY-MM", "adimlar": [...]}
    """
    from datetime import date

    if not borc_listesi:
        return {"yontem": "avalanche", "toplam_borc": 0,
                "aylik_ekstra_odeme": aylik_ekstra_odeme,
                "tahmini_bitis_ay": "", "adimlar": []}

    # Borçları kopyala (orijinali bozmadan) ve faiz oranına göre büyükten küçüğe sırala
    # KARAR: faiz_orani YILLIK yüzde olarak saklanır (DebtMap UI'da "%X yıllık" görünür).
    # Aylık faiz = yıllık / 12 / 100  (örn: %4.5 yıllık → 0.00375 aylık)
    borclar = []
    for b in borc_listesi:
        yillik_yuzde = float(b.get("faiz_orani", 3.0))
        borclar.append({
            "aciklama": b.get("aciklama", "Borç"),
            "kalan": float(b.get("ana_para", 0)),
            "aylik_faiz_orani": yillik_yuzde / 100.0 / 12.0,  # yıllık % → aylık ondalık
            "min_odeme": float(b.get("aylik_odeme", 0)),
        })
    borclar.sort(key=lambda x: x["aylik_faiz_orani"], reverse=True)

    toplam_borc_baslangic = sum(b["kalan"] for b in borclar)
    serbest_ekstra = float(aylik_ekstra_odeme)  # Biten borçların min ödemesi buraya eklenir

    adimlar = []
    bugun = date.today()

    for ay_no in range(max_ay):
        # Tarih hesabı: bugünün ayından başla
        toplam_ay = bugun.month + ay_no
        yil = bugun.year + (toplam_ay - 1) // 12
        ay = ((toplam_ay - 1) % 12) + 1
        ay_str = f"{yil}-{ay:02d}"

        # Her borca faiz tahakkuk + minimum ödeme
        ay_toplam_odeme = 0.0
        for b in borclar:
            if b["kalan"] <= 0:
                continue
            # Faiz tahakkuku
            b["kalan"] += b["kalan"] * b["aylik_faiz_orani"]
            # Minimum ödeme uygula
            odeme = min(b["min_odeme"], b["kalan"])
            b["kalan"] -= odeme
            ay_toplam_odeme += odeme

        # Ekstra ödemeyi en yüksek faizli aktif borca uygula
        bitecek_borc_adi = None
        ekstra_kalan = serbest_ekstra
        for b in borclar:
            if b["kalan"] <= 0 or ekstra_kalan <= 0:
                continue
            uygulanacak = min(ekstra_kalan, b["kalan"])
            b["kalan"] -= uygulanacak
            ekstra_kalan -= uygulanacak
            ay_toplam_odeme += uygulanacak
            if b["kalan"] <= 0.01:
                # Borç bitti — min ödemesini serbest ekstraya ekle
                serbest_ekstra += b["min_odeme"]
                bitecek_borc_adi = b["aciklama"]
            break  # Avalanche: sadece en yüksek faizliye ekstra

        # Bitenleri kontrol et (ekstra uygulamadan da bitebilirler)
        for b in borclar:
            if 0 < b["kalan"] <= 0.01:
                b["kalan"] = 0
                serbest_ekstra += b["min_odeme"]
                if not bitecek_borc_adi:
                    bitecek_borc_adi = b["aciklama"]

        toplam_kalan = sum(max(0, b["kalan"]) for b in borclar)

        adimlar.append({
            "ay": ay_str,
            "odeme_tutari": round(ay_toplam_odeme, 2),
            "kalan_borc": round(toplam_kalan, 2),
            "bitecek_borc": bitecek_borc_adi or "",
        })

        if toplam_kalan <= 0.01:
            break

    bitis_ay = adimlar[-1]["ay"] if adimlar else ""

    return {
        "yontem": "avalanche",
        "toplam_borc": round(toplam_borc_baslangic, 2),
        "aylik_ekstra_odeme": float(aylik_ekstra_odeme),
        "tahmini_bitis_ay": bitis_ay,
        "adimlar": adimlar,
    }


async def analiz_agent_node(state: PipelineState) -> PipelineState:
    """
    Pipeline'ın finansal analiz adımı:
    1. Kategorilerden gelir/gider hesaplar
    2. Borç listesini çıkarır ve TCMB ile sınıflandırır
    3. Deterministik ağırlıklı algoritmayla finansal skor hesaplar
    4. FinancialSnapshot oluşturur ve Firestore'a kaydeder
    """
    try:
        kategorili_islemler = state.get("kategorili_islemler", [])
        tcmb_verisi = state.get("tcmb_verisi") or {}
        user_id = state.get("user_id", "")

        if not kategorili_islemler:
            state["hata"] = "Analiz için kategori listesi boş"
            state["mevcut_adim"] = "analiz_hata"
            return state

        # ── Gelir / Gider hesapla ─────────────────────────────────
        toplam_gelir = 0.0
        toplam_gider = 0.0

        for kategori in kategorili_islemler:
            tutar = float(kategori.get("toplam_tutar", 0))
            if tutar > 0:
                toplam_gelir += tutar
            else:
                toplam_gider += abs(tutar)

        # ── Borç listesini tespit et ve sınıflandır ───────────────
        borc_kategori_anahtar = [
            "kredi", "borç", "taksit", "kredi kartı",
            "loan", "mortgage", "ödeme"
        ]
        borc_listesi_raw = []

        for kategori in kategorili_islemler:
            kat_adi = kategori.get("kategori_adi", "").lower()
            if any(k in kat_adi for k in borc_kategori_anahtar):
                for islem in kategori.get("islemler", []):
                    aylik = abs(float(islem.get("tutar", 0)))
                    if aylik > 0:
                        sinif_bilgi = borc_siniflandir(
                            aciklama=islem.get("aciklama", ""),
                            aylik_odeme=aylik,
                            tcmb=tcmb_verisi
                        )
                        borc_listesi_raw.append({
                            "aciklama": islem.get("aciklama", "Borç Ödemesi"),
                            # KARAR: Ana para tahmini = aylık ödeme × 24 ay
                            "ana_para": aylik * 24,
                            "faiz_orani": sinif_bilgi["faiz_orani"],
                            "kalan_taksit": 24,
                            "aylik_odeme": aylik,
                            "siniflandirma": sinif_bilgi["siniflandirma"]
                        })

        # ── Finansal skoru deterministik hesapla ──────────────────
        finansal_skor = finansal_skor_hesapla(
            toplam_gelir=toplam_gelir,
            toplam_gider=toplam_gider,
            borc_listesi=borc_listesi_raw,
            kategoriler=kategorili_islemler
        )

        print(f"[Analiz Agent] Skor hesaplandı: {finansal_skor}/100")
        print(f"  - Gelir: {toplam_gelir:,.2f} TL")
        print(f"  - Gider: {toplam_gider:,.2f} TL")
        print(f"  - Nakit Akışı: {toplam_gelir - toplam_gider:,.2f} TL")
        print(f"  - Borç sayısı: {len(borc_listesi_raw)}")

        # ── Ay bilgisini işlem tarihlerinden çıkar ────────────────
        tum_tarihler = []
        for kategori in kategorili_islemler:
            for islem in kategori.get("islemler", []):
                tarih = islem.get("tarih", "")
                if tarih and len(tarih) >= 7:
                    tum_tarihler.append(tarih[:7])

        ay = max(tum_tarihler) if tum_tarihler else datetime.now().strftime("%Y-%m")

        # ── Pydantic modellerine çevir ────────────────────────────
        kategori_modelleri = []
        for kat in kategorili_islemler:
            islem_modelleri = []
            for islem in kat.get("islemler", []):
                try:
                    # Transaction modelinin alanlarını eşleştir
                    islem_modelleri.append(Transaction(
                        tarih=str(islem.get("tarih", "")),
                        tutar=float(islem.get("tutar", 0)),
                        aciklama=str(islem.get("aciklama", "")),
                        banka=str(islem.get("banka", "")),
                        tur=str(islem.get("tur", "gider")),
                        kategori=islem.get("kategori")
                    ))
                except Exception:
                    pass

            try:
                kategori_modelleri.append(Category(
                    kategori_adi=kat.get("kategori_adi", "Diğer"),
                    toplam_tutar=float(kat.get("toplam_tutar", 0)),
                    islem_sayisi=int(kat.get("islem_sayisi", len(islem_modelleri))),
                    abonelik_mi=bool(kat.get("abonelik_mi", False)),
                    islemler=islem_modelleri
                ))
            except Exception:
                pass

        borc_modelleri = []
        for borc in borc_listesi_raw:
            try:
                borc_modelleri.append(DebtItem(
                    aciklama=borc.get("aciklama", ""),
                    ana_para=float(borc.get("ana_para", 0)),
                    faiz_orani=float(borc.get("faiz_orani", 0)),
                    kalan_taksit=int(borc.get("kalan_taksit", 0)),
                    aylik_odeme=float(borc.get("aylik_odeme", 0)),
                    siniflandirma=borc.get("siniflandirma", "yonetilebilir")
                ))
            except Exception:
                pass

        tcmb_modeli = TCMBData(**tcmb_verisi) if tcmb_verisi else None

        snapshot = FinancialSnapshot(
            user_id=user_id,
            ay=ay,
            gelir=toplam_gelir,
            toplam_gider=toplam_gider,
            nakit_akisi=toplam_gelir - toplam_gider,
            kategoriler=kategori_modelleri,
            borc_listesi=borc_modelleri,
            finansal_skor=finansal_skor,
            tcmb_verisi=tcmb_modeli
        )

        # Firestore'a kaydet
        await firebase_service.snapshot_kaydet(snapshot)
        print(f"[Analiz Agent] Snapshot kaydedildi — Kullanıcı: {user_id}, Ay: {ay}")

        state["snapshot"] = snapshot.model_dump()
        state["mevcut_adim"] = "analiz_tamamlandi"
        state["hata"] = None

    except Exception as e:
        state["hata"] = f"Analiz hatası: {e}"
        state["mevcut_adim"] = "analiz_hata"

    return state
