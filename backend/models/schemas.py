"""
ParaPusula - Pydantic veri modelleri
Tüm API request/response ve iç veri yapıları burada tanımlanır.
"""

from __future__ import annotations
from enum import Enum
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from typing_extensions import TypedDict


# ─────────────────────────────────────────────
# Enum tanımları
# ─────────────────────────────────────────────

class GelirDuzeni(str, Enum):
    """Kullanıcının gelir düzeni türü"""
    SABIT_MAAS = "sabit_maas"
    DEGISKEN = "degisken"
    IKISI_DE = "ikisi_de"


class MevcutDurum(str, Enum):
    """Kullanıcının mevcut finansal durumu"""
    AY_SONU_BITIYOR = "ay_sonu_bitiyor"
    IDARE_EDIYORUM = "idare_ediyorum"
    DUZENLI_KALIYOR = "duzenli_kaliyor"


class AnaHedef(str, Enum):
    """Kullanıcının birincil finansal hedefi"""
    BORÇTAN_KURTULMAK = "borctan_kurtulmak"
    HEDEFE_BIRIKIM = "hedefe_birikim"
    HARCAMALARI_ANLAMAK = "harcamalari_anlamak"


class HarcamaAliskanligi(str, Enum):
    """Kullanıcının harcama alışkanlığı tipi"""
    DURTÜSEL = "durtüsel"
    PLANLI_AMA_KAYIYOR = "planli_ama_kayiyor"
    COK_TUTUMLU = "cok_tutumlu"


# ─────────────────────────────────────────────
# Kullanıcı Profili
# ─────────────────────────────────────────────

class UserProfile(BaseModel):
    """Onboarding sırasında oluşturulan kullanıcı profili"""
    user_id: str
    gelir_duzeni: GelirDuzeni
    mevcut_durum: MevcutDurum
    ana_hedef: AnaHedef
    harcama_aliskanligi: HarcamaAliskanligi
    olusturulma_tarihi: str = Field(default_factory=lambda: datetime.now().isoformat())


# ─────────────────────────────────────────────
# İşlem ve Kategori modelleri
# ─────────────────────────────────────────────

class Transaction(BaseModel):
    """Tek bir banka işlemi"""
    tarih: str                          # "2025-01-15" formatında
    tutar: float                        # Pozitif = gelir, negatif = gider
    aciklama: str                       # İşlem açıklaması
    banka: str                          # "Ziraat" veya "Halkbank"
    tur: str                            # "gelir" veya "gider"
    kategori: Optional[str] = None      # Kategorizasyon sonrası dolar


class DebtItem(BaseModel):
    """Tek bir borç kalemi"""
    aciklama: str
    ana_para: float
    faiz_orani: float                   # Yıllık yüzde olarak
    kalan_taksit: int
    aylik_odeme: float
    siniflandirma: str                  # "stratejik" | "gri" | "kotu"


class Category(BaseModel):
    """Bir harcama kategorisi ve içindeki işlemler"""
    kategori_adi: str
    toplam_tutar: float
    islem_sayisi: int
    abonelik_mi: bool = False
    islemler: List[Transaction] = []


# ─────────────────────────────────────────────
# TCMB Makro Veri
# ─────────────────────────────────────────────

class TCMBData(BaseModel):
    """TCMB'den çekilen güncel makroekonomik veriler"""
    tufe: float = 65.0                  # TÜFE yıllık enflasyon oranı (%)
    kfe: float = 34.0                   # ÜFE/KFE yıllık oran (%)
    azami_faiz: float = 4.5             # Aylık azami kredi faiz oranı (%)
    asgari_ucret: float = 22104.0       # Aylık brüt asgari ücret (TL)
    guncelleme_tarihi: str = Field(
        default_factory=lambda: datetime.now().isoformat()
    )


# ─────────────────────────────────────────────
# Finansal Anlık Görüntü
# ─────────────────────────────────────────────

class FinancialSnapshot(BaseModel):
    """Belirli bir ay için kullanıcının finansal durumunun tam görüntüsü"""
    user_id: str
    ay: str                             # "2025-01" formatında
    gelir: float
    toplam_gider: float
    nakit_akisi: float                  # gelir - toplam_gider
    kategoriler: List[Category] = []
    borc_listesi: List[DebtItem] = []
    finansal_skor: int = Field(ge=0, le=100)  # 0-100 arası puan
    tcmb_verisi: Optional[TCMBData] = None
    # Öneri agent tarafından analiz_guncelle ile eklenir
    oneriler: List[dict] = []
    borc_cikis_plani: Optional[dict] = None
    olusturulma_tarihi: str = Field(
        default_factory=lambda: datetime.now().isoformat()
    )


# ─────────────────────────────────────────────
# Öneri ve Borç Çıkış Planı
# ─────────────────────────────────────────────

class Recommendation(BaseModel):
    """Kullanıcıya önerilen somut aksiyon"""
    baslik: str
    aciklama: str
    oncelik: int = Field(ge=1, le=3)    # 1=yüksek, 2=orta, 3=düşük


class BorcCikisPlan(BaseModel):
    """Borçtan çıkış stratejisi (Avalanche veya Snowball)"""
    yontem: str                         # "avalanche" veya "snowball"
    toplam_borc: float
    aylik_ekstra_odeme: float
    tahmini_bitis_ay: str               # "2027-06" formatında
    adimlar: List[dict] = []            # Her adım: {ay, borc_adi, odeme, kalan}


# ─────────────────────────────────────────────
# LangGraph Pipeline State
# ─────────────────────────────────────────────

class PipelineState(TypedDict, total=False):
    """
    LangGraph pipeline'ının durumu.
    Her agent node bu dict'i alır ve günceller.
    """
    user_id: str
    pdf_dosya_yolu: str
    banka: str                          # "Ziraat" veya "Halkbank"
    ham_islemler: List[dict]            # PDF'den çıkan ham işlemler
    kategorili_islemler: List[dict]     # Kategorize edilmiş işlemler
    tcmb_verisi: Optional[dict]         # TCMB makro verileri
    snapshot: Optional[dict]            # FinancialSnapshot dict
    oneriler: List[dict]                # Recommendation listesi
    borc_cikis_plani: Optional[dict]    # BorcCikisPlan dict
    hata: Optional[str]                 # Hata mesajı (None ise başarılı)
    mevcut_adim: str                    # Pipeline'da hangi adımda
    kullanici_profili: Optional[dict]   # UserProfile dict


# ─────────────────────────────────────────────
# API Request / Response Modelleri
# ─────────────────────────────────────────────

class OnboardingRequest(BaseModel):
    """Onboarding formu verisi"""
    user_id: str
    gelir_duzeni: GelirDuzeni
    mevcut_durum: MevcutDurum
    ana_hedef: AnaHedef
    harcama_aliskanligi: HarcamaAliskanligi


class ChatRequest(BaseModel):
    """Sohbet isteği"""
    user_id: str
    mesaj: str


class ChatResponse(BaseModel):
    """Sohbet yanıtı"""
    yanit: str
    user_id: str


class UploadResponse(BaseModel):
    """PDF yükleme sonrası dönen yanıt"""
    job_id: str
    durum: str = "isleniyor"
    mesaj: str = "PDF yüklendi, analiz arka planda devam ediyor."
