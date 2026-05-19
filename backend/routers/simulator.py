"""
ParaPusula - Senaryo Simülatörü Router
İki endpoint:
  POST /simulator/borc-hizlandirma  → Deterministik borç ödeme simülasyonu
  POST /simulator/buyuk-karar       → Gemini ile büyük finansal karar analizi
"""

import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from services.firebase_service import firebase_service
from services.gemini_service import gemini_service

router = APIRouter()


# ─── Modeller ─────────────────────────────────────────────────

class BorcHizlandirmaIstek(BaseModel):
    ana_para: float
    aylik_odeme: float
    faiz_orani_yillik: float   # Yıllık % (örn: 45.0)
    ekstra_odeme: float
    borc_adi: str = "Borç"

class BorcHizlandirmaSonuc(BaseModel):
    mevcut_plan: List[float]         # Her ay sonundaki kalan borç
    hizli_plan: List[float]
    tasarruf: float                  # Faiz tasarrufu (TL)
    ay_farki: int                    # Kaç ay erken bitiyor
    mevcut_toplam_odeme: float
    hizli_toplam_odeme: float
    gemini_yorum: str


class BuyukKararIstek(BaseModel):
    user_id: str
    soru: str

class OzetSatir(BaseModel):
    gelir: float = 0
    gider: float = 0
    nakit: float = 0
    toplam_borc: float = 0

class BuyukKararSonuc(BaseModel):
    finansal_etki: str
    uyari: str
    adimlar: List[str]
    ozet_simdi: dict
    ozet_sonra: dict


# ─── Yardımcı fonksiyonlar ─────────────────────────────────────

def _borc_sim(ana_para: float, aylik_odeme: float, faiz_aylik: float,
              ekstra: float = 0, max_ay: int = 480) -> tuple[list, float]:
    """
    Aylık borç kalan bakiyesini simüle eder.
    Döner: (kalan_listesi, toplam_faiz)
    """
    kalan = float(ana_para)
    plan: list[float] = []
    toplam_faiz = 0.0
    odeme = aylik_odeme + ekstra

    for _ in range(max_ay):
        if kalan <= 0.01:
            break
        faiz = kalan * faiz_aylik
        toplam_faiz += faiz
        anapara_kismi = odeme - faiz
        if anapara_kismi <= 0:
            # Ödeme faizi bile karşılamıyor — sonsuz döngü riski; dur
            break
        kalan = max(0.0, kalan - anapara_kismi)
        plan.append(round(kalan, 2))

    return plan, round(toplam_faiz, 2)


def _ay_etiketi(ay_index: int) -> str:
    """0 tabanlı ay indeksinden 'Haz 2026' formatında Türkçe etiket üretir."""
    from datetime import date
    AYLAR = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"]
    bugun = date.today()
    toplam_ay = bugun.month + ay_index
    yil = bugun.year + (toplam_ay - 1) // 12
    ay  = ((toplam_ay - 1) % 12) + 1
    return f"{AYLAR[ay - 1]} {yil}"


# ─── Endpoint 1: Borç Hızlandırma ─────────────────────────────

@router.post("/simulator/borc-hizlandirma", response_model=BorcHizlandirmaSonuc)
async def borc_hizlandirma(istek: BorcHizlandirmaIstek):
    """
    Deterministik borç simülasyonu.
    Ekstra ödemeyle kaç ay erken biter, ne kadar faiz tasarrufu olur?
    """
    if istek.ana_para <= 0 or istek.aylik_odeme <= 0:
        raise HTTPException(status_code=400, detail="Ana para ve aylık ödeme pozitif olmalı.")
    if istek.ekstra_odeme < 0:
        raise HTTPException(status_code=400, detail="Ekstra ödeme negatif olamaz.")

    faiz_aylik = istek.faiz_orani_yillik / 12.0 / 100.0

    # Güvenlik: ödeme faizi bile karşılamıyorsa hata ver
    if istek.aylik_odeme <= istek.ana_para * faiz_aylik:
        raise HTTPException(
            status_code=400,
            detail="Aylık ödeme tutarı faizi karşılamıyor — borç hiç azalmaz."
        )

    mevcut_plan, faiz_mevcut = _borc_sim(
        istek.ana_para, istek.aylik_odeme, faiz_aylik, ekstra=0
    )
    hizli_plan, faiz_hizli = _borc_sim(
        istek.ana_para, istek.aylik_odeme, faiz_aylik, ekstra=istek.ekstra_odeme
    )

    tasarruf  = round(faiz_mevcut - faiz_hizli, 2)
    ay_farki  = len(mevcut_plan) - len(hizli_plan)
    mevcut_toplam = round(istek.ana_para + faiz_mevcut, 2)
    hizli_toplam  = round(istek.ana_para + faiz_hizli, 2)

    # Bitiş ayı etiketleri
    eski_bitis = _ay_etiketi(len(mevcut_plan))
    yeni_bitis = _ay_etiketi(len(hizli_plan))

    # Gemini yorumu — kısa ve empatik
    try:
        prompt = f"""
Sen ParaPusula finansal asistanısın. Kullanıcı "{istek.borc_adi}" borcuna
aylık {istek.ekstra_odeme:,.0f} TL ekstra ödeme yapıyor.

Mevcut bitiş tarihi: {eski_bitis}
Yeni (hızlandırılmış) bitiş tarihi: {yeni_bitis}
Faiz tasarrufu: {tasarruf:,.0f} TL
Toplam ödeme farkı: {mevcut_toplam:,.0f} TL → {hizli_toplam:,.0f} TL

Bunu 2-3 cümleyle empatik Türkçe yorumla. Motivasyon ver.
Son cümlede 1 pratik uyarı ekle (örn: "Bu ekstra ödemeyi her ay düzenli yapabilmek için...").
Yalnızca düz metin döndür, başlık veya madde işareti kullanma.
"""
        resp = await gemini_service._generate_with_retry(prompt)
        gemini_yorum = resp.text.strip()
    except Exception as e:
        gemini_yorum = (
            f"{istek.borc_adi} borcunuzu {ay_farki} ay erken kapatarak "
            f"{tasarruf:,.0f} TL faiz tasarrufu sağlıyorsunuz. Harika bir karar!"
        )

    return BorcHizlandirmaSonuc(
        mevcut_plan=mevcut_plan,
        hizli_plan=hizli_plan,
        tasarruf=tasarruf,
        ay_farki=ay_farki,
        mevcut_toplam_odeme=mevcut_toplam,
        hizli_toplam_odeme=hizli_toplam,
        gemini_yorum=gemini_yorum,
    )


# ─── Endpoint 2: Büyük Karar ──────────────────────────────────

@router.post("/simulator/buyuk-karar", response_model=BuyukKararSonuc)
async def buyuk_karar(istek: BuyukKararIstek):
    """
    Kullanıcının finansal verisiyle büyük karar senaryosunu Gemini ile analiz eder.
    """
    if not istek.soru or not istek.soru.strip():
        raise HTTPException(status_code=400, detail="Soru boş olamaz.")
    if len(istek.soru) > 1000:
        raise HTTPException(status_code=400, detail="Soru 1000 karakterden uzun olamaz.")

    # Kullanıcı snapshot'ını çek
    snapshot = None
    tcmb = None
    try:
        snapshot = await firebase_service.son_snapshot_oku(istek.user_id)
    except Exception:
        pass

    if snapshot is None:
        raise HTTPException(
            status_code=404,
            detail="Analiz verisi bulunamadı. Önce banka ekstrenizi yükleyin."
        )

    s = snapshot.model_dump()
    gelir  = s.get("gelir", 0)
    gider  = s.get("toplam_gider", 0)
    nakit  = s.get("nakit_akisi", 0)
    skor   = s.get("finansal_skor", 0)

    borc_satirlari = []
    toplam_borc = 0.0
    for b in s.get("borc_listesi", []):
        toplam_borc += float(b.get("ana_para", 0))
        borc_satirlari.append(
            f"- {b.get('aciklama','?')}: {b.get('aylik_odeme',0):,.0f} TL/ay, "
            f"ana para {b.get('ana_para',0):,.0f} TL [{b.get('siniflandirma','?').upper()}]"
        )
    borclar_str = "\n".join(borc_satirlari) or "Borç yok"

    tcmb_str = ""
    if s.get("tcmb_verisi"):
        t = s["tcmb_verisi"]
        tcmb_str = f"TÜFE %{t.get('tufe',30.65)}, KFE %{t.get('kfe',34.0)}, Azami faiz %{t.get('azami_faiz',5.1)}/ay"

    prompt = f"""
Sen ParaPusula finansal asistanısın. Kullanıcının finansal durumu:

Aylık gelir: {gelir:,.0f} TL
Aylık gider: {gider:,.0f} TL
Nakit akışı: {nakit:+,.0f} TL
Finansal skor: {skor}/100
Toplam borç: {toplam_borc:,.0f} TL
Borçlar:
{borclar_str}
{f"Makro ekonomi: {tcmb_str}" if tcmb_str else ""}

Kullanıcı sorusu: {istek.soru}

Şunları içeren yapılandırılmış bir yanıt ver.
Sayısal tahminleri kullanıcının gerçek verilerine göre yap.
Türkçe yaz.

ZORUNLU olarak aşağıdaki JSON formatında döndür (başka bir şey yazma):
{{
  "finansal_etki": "Somut sayısal hesaplama ve analiz (2-3 cümle)",
  "uyari": "Dikkat edilmesi gereken 1 pratik risk veya uyarı",
  "adimlar": ["Adım 1", "Adım 2", "Adım 3"],
  "ozet_simdi": {{"gelir": {gelir:.0f}, "gider": {gider:.0f}, "nakit": {nakit:.0f}, "toplam_borc": {toplam_borc:.0f}}},
  "ozet_sonra": {{"gelir": <tahmini>, "gider": <tahmini>, "nakit": <tahmini>, "toplam_borc": <tahmini>}}
}}
"""

    try:
        resp = await gemini_service._generate_with_retry(prompt)
        raw = resp.text.strip()

        # JSON temizle
        import re
        raw = re.sub(r'```json\s*', '', raw)
        raw = re.sub(r'```\s*', '', raw)
        raw = raw.strip()

        veri = json.loads(raw)

        # ozet alanlarını güvenli şekilde parse et
        def safe_ozet(d: dict) -> dict:
            return {
                "gelir":       float(d.get("gelir", 0)),
                "gider":       float(d.get("gider", 0)),
                "nakit":       float(d.get("nakit", 0)),
                "toplam_borc": float(d.get("toplam_borc", 0)),
            }

        return BuyukKararSonuc(
            finansal_etki=str(veri.get("finansal_etki", "")),
            uyari=str(veri.get("uyari", "")),
            adimlar=[str(a) for a in veri.get("adimlar", [])],
            ozet_simdi=safe_ozet(veri.get("ozet_simdi", {})),
            ozet_sonra=safe_ozet(veri.get("ozet_sonra", {})),
        )

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"AI yanıtı parse edilemedi: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Senaryo analizi başarısız: {e}")
