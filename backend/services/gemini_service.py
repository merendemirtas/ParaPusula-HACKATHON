"""
ParaPusula - Gemini AI Servisi
Tüm Gemini API çağrıları bu servis üzerinden yapılır.
Singleton pattern ile tek instance kullanılır.
"""

import os
import re
import json
import asyncio
from typing import Optional
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()


class GeminiService:
    """
    Gemini 2.0 Flash modeliyle tüm AI işlemlerini yöneten servis.
    PDF okuma, kategorizasyon, analiz ve öneri üretimi buradan yapılır.
    """

    def __init__(self):
        # API anahtarını ortam değişkeninden yükle (lazy: çağrı anında kontrol edilir)
        self._api_key = os.getenv("GEMINI_API_KEY", "")
        self._model = None  # İlk gerçek çağrıda başlatılır

    def _get_model(self):
        """Model nesnesini lazy olarak başlatır (ilk çağrıda)."""
        if self._model is None:
            if not self._api_key:
                raise ValueError(
                    "GEMINI_API_KEY ortam değişkeni tanımlanmamış! "
                    "backend/.env dosyasını oluşturun."
                )
            genai.configure(api_key=self._api_key)
            self._model = genai.GenerativeModel("gemini-2.5-flash")
        return self._model

    @property
    def model(self):
        return self._get_model()

    async def _generate_with_retry(self, *args, max_deneme: int = 3, **kwargs):
        """
        Gemini generate_content'i 429 rate limit hatalarında retry yapar.
        Her denemede bekleme süresini ikiye katlar (exponential backoff).
        Günlük kota tamamen dolmuşsa (limit=0) anında hata fırlatır.
        """
        for deneme in range(max_deneme):
            try:
                # Gemini sync API'yi thread'de çalıştır (async uyumluluk)
                sonuc = await asyncio.to_thread(
                    self.model.generate_content, *args, **kwargs
                )
                return sonuc
            except Exception as e:
                hata_str = str(e)
                # 429 rate limit hatası
                if "429" in hata_str:
                    # Günlük kota tamamen dolmuş: limit=0 → retry faydasız
                    if "limit: 0" in hata_str and "PerDay" in hata_str:
                        print(f"[GEMINI] Günlük kota tükendi. Yeni API key gerekiyor.")
                        raise RuntimeError(
                            "Gemini API günlük kotası tükendi. "
                            "Google AI Studio'dan yeni bir API key alın: https://aistudio.google.com"
                        )
                    # Geçici rate limit: bekle ve tekrar dene
                    bekleme = 2 ** deneme  # 1s, 2s, 4s
                    print(f"[GEMINI] Rate limit (429), {bekleme}s bekleniyor... (deneme {deneme+1}/{max_deneme})")
                    await asyncio.sleep(bekleme)
                    if deneme == max_deneme - 1:
                        raise RuntimeError(
                            f"Gemini API {max_deneme} denemede de yanıt vermedi. "
                            "Lütfen birkaç dakika sonra tekrar deneyin."
                        )
                else:
                    raise  # 429 dışındaki hataları direkt fırlat

    def _rag_baglamlari_olustur(self, tcmb: Optional[dict], profil: Optional[dict]) -> str:
        """
        TCMB makro verisi ve kullanıcı profilini sistem prompt'a eklemek için
        bağlam metni oluşturur. RAG benzeri yaklaşım.
        """
        baglamlar = []

        # TCMB makro verileri bağlamı
        if tcmb:
            baglamlar.append(f"""
GÜNCEL EKONOMİK BAĞLAM (TCMB Verileri):
- Yıllık TÜFE Enflasyonu: %{tcmb.get('tufe', 65.0)}
- Yıllık ÜFE/KFE: %{tcmb.get('kfe', 34.0)}
- Aylık Azami Kredi Faiz Oranı: %{tcmb.get('azami_faiz', 4.5)}
- Brüt Asgari Ücret: {tcmb.get('asgari_ucret', 22104.0):,.0f} TL
Bu verileri analizde referans al. Kullanıcının harcamalarını enflasyona göre değerlendir.
""")

        # Kullanıcı profili bağlamı
        if profil:
            gelir_map = {
                "sabit_maas": "Sabit Maaşlı",
                "degisken": "Değişken Gelirli",
                "ikisi_de": "Karma Gelirli"
            }
            durum_map = {
                "ay_sonu_bitiyor": "Ay sonu para bitiyor",
                "idare_ediyorum": "İdare edebiliyorum",
                "duzenli_kaliyor": "Düzenli para kalıyor"
            }
            hedef_map = {
                "borctan_kurtulmak": "Borçtan kurtulmak",
                "hedefe_birikim": "Hedefe birikim yapmak",
                "harcamalari_anlamak": "Harcamalarını anlamak"
            }
            aliskanlik_map = {
                "durtüsel": "Dürtüsel harcama yapıyor",
                "planli_ama_kayiyor": "Planlı ama kayıyor",
                "cok_tutumlu": "Çok tutumlu"
            }
            baglamlar.append(f"""
KULLANICI PROFİLİ:
- Gelir Düzeni: {gelir_map.get(profil.get('gelir_duzeni', ''), profil.get('gelir_duzeni', 'Bilinmiyor'))}
- Mevcut Durum: {durum_map.get(profil.get('mevcut_durum', ''), profil.get('mevcut_durum', 'Bilinmiyor'))}
- Ana Hedef: {hedef_map.get(profil.get('ana_hedef', ''), profil.get('ana_hedef', 'Bilinmiyor'))}
- Harcama Alışkanlığı: {aliskanlik_map.get(profil.get('harcama_aliskanligi', ''), profil.get('harcama_aliskanligi', 'Bilinmiyor'))}
Önerilerini ve analizini bu profile göre kişiselleştir.
""")

        return "\n".join(baglamlar)

    def _json_temizle(self, metin: str) -> str:
        """
        Gemini'nin döndürdüğü metinden JSON bloğunu temizler.
        Markdown kod bloğu işaretlerini kaldırır.
        """
        # ```json ... ``` veya ``` ... ``` bloklarını temizle
        metin = re.sub(r'```json\s*', '', metin)
        metin = re.sub(r'```\s*', '', metin)
        return metin.strip()

    async def pdf_icerik_cikar(
        self,
        file_content: bytes,
        banka: str,
        tcmb: Optional[dict] = None,
        profil: Optional[dict] = None,
        prompt_override: Optional[str] = None
    ) -> list:
        """
        Banka PDF'inden işlemleri çıkarır.
        Gemini'ye PDF bytes'ını gönderir, yapılandırılmış JSON yanıt alır.

        Args:
            file_content: PDF dosyasının ham bytes verisi
            banka: "Ziraat" veya "Halkbank"
            tcmb: TCMB makro verileri (isteğe bağlı)
            profil: Kullanıcı profili (isteğe bağlı)

        Returns:
            List[dict]: Her biri Transaction formatında işlem listesi
        """
        try:
            # prompt_override verilmişse doğrudan onu kullan
            if prompt_override:
                response = await self._generate_with_retry(
                    [{"mime_type": "application/pdf", "data": file_content}, prompt_override]
                )
                yanit_metni = self._json_temizle(response.text)
                islemler = json.loads(yanit_metni)

                def _faiz_al(i):
                    """faiz_orani alanını güvenli float veya None olarak döndürür."""
                    val = i.get("faiz_orani")
                    if val is None:
                        return None
                    try:
                        f = float(val)
                        return f if 0 < f <= 500 else None
                    except (TypeError, ValueError):
                        return None

                return [
                    {
                        "tarih":       str(i.get("tarih", "")),
                        "tutar":       float(i.get("tutar", 0)),
                        "aciklama":    str(i.get("aciklama", "")),
                        "banka":       str(i.get("banka", banka)),
                        "tur":         str(i.get("tur", "gider")),
                        "kategori":    i.get("kategori"),
                        "faiz_orani":  _faiz_al(i),
                    }
                    for i in islemler
                    if isinstance(i, dict) and "tarih" in i and "tutar" in i
                ]

            # Bağlam oluştur
            baglamlar = self._rag_baglamlari_olustur(tcmb, profil)

            # Banka tipine göre prompt ayarla
            banka_ipucu = ""
            if banka.lower() == "ziraat":
                banka_ipucu = """
Ziraat Bankası hesap ekstresi formatı:
- İşlem tarihi genellikle GG.AA.YYYY formatındadır
- Borç (gider) ve Alacak (gelir) sütunları ayrıdır
- Tutar TL cinsindendir, nokta veya virgül ondalık ayırıcı olabilir
"""
            elif banka.lower() == "halkbank":
                banka_ipucu = """
Halkbank hesap ekstresi formatı:
- İşlem tarihi GG/AA/YYYY veya GG-AA-YYYY olabilir
- Çıkış ve Giriş sütunları ayrıdır
- Açıklama sütununda işlem detayı yer alır
"""

            prompt = f"""
{baglamlar}

Sen bir banka ekstresi analiz uzmanısın. Aşağıdaki PDF bir {banka} banka ekstresidir.
{banka_ipucu}

Bu ekstreden TÜM finansal işlemleri çıkar. Her işlem için:
- tarih: "YYYY-MM-DD" formatında (örn: "2025-01-15")
- tutar: Sayısal değer (gider için negatif, gelir için pozitif) - örn: -250.50 veya 15000.00
- aciklama: İşlemin kısa, anlamlı açıklaması (Türkçe)
- banka: "{banka}"
- tur: "gelir" veya "gider"

Aşağıdaki JSON formatında yanıt ver (başka hiçbir şey yazma):
[
  {{
    "tarih": "2025-01-05",
    "tutar": -450.00,
    "aciklama": "Migros Market Alışverişi",
    "banka": "{banka}",
    "tur": "gider"
  }},
  {{
    "tarih": "2025-01-01",
    "tutar": 25000.00,
    "aciklama": "Maaş Ödemesi",
    "banka": "{banka}",
    "tur": "gelir"
  }}
]

Sadece geçerli JSON döndür. Markdown, açıklama veya kod bloğu kullanma.
"""

            # PDF'i Gemini'ye gönder
            response = await self._generate_with_retry(
                [{"mime_type": "application/pdf", "data": file_content}, prompt]
            )

            # Yanıtı parse et
            yanit_metni = self._json_temizle(response.text)
            islemler = json.loads(yanit_metni)

            # Tip güvenliği: her işlem için gerekli alanları kontrol et
            temiz_islemler = []
            for islem in islemler:
                if isinstance(islem, dict) and "tarih" in islem and "tutar" in islem:
                    temiz_islemler.append({
                        "tarih": str(islem.get("tarih", "")),
                        "tutar": float(islem.get("tutar", 0)),
                        "aciklama": str(islem.get("aciklama", "")),
                        "banka": str(islem.get("banka", banka)),
                        "tur": str(islem.get("tur", "gider")),
                        "kategori": islem.get("kategori", None)
                    })

            return temiz_islemler

        except json.JSONDecodeError as e:
            raise ValueError(f"Gemini'den geçersiz JSON yanıtı alındı: {e}")
        except Exception as e:
            raise RuntimeError(f"PDF içerik çıkarma hatası: {e}")

    async def kategorize_et(
        self,
        islemler: list,
        tcmb: Optional[dict] = None,
        profil: Optional[dict] = None
    ) -> list:
        """
        İşlemleri kategorilere ayırır, abonelikleri tespit eder.

        Args:
            islemler: Transaction formatında işlem listesi
            tcmb: TCMB makro verileri
            profil: Kullanıcı profili

        Returns:
            List[dict]: Her biri Category formatında kategori listesi
        """
        try:
            baglamlar = self._rag_baglamlari_olustur(tcmb, profil)

            islemler_json = json.dumps(islemler, ensure_ascii=False, indent=2)

            prompt = f"""
{baglamlar}

Sen bir kişisel finans analisti ve kategorizasyon uzmanısın.
Aşağıdaki banka işlemlerini analiz et ve Türkçe kategorilere ayır.

İŞLEMLER:
{islemler_json}

Görevler:
1. Her işleme uygun bir Türkçe kategori ata (örn: "Market Alışverişi", "Faturalar", "Yemek & Restoran",
   "Ulaşım", "Eğlence", "Sağlık", "Eğitim", "Giyim", "Kredi/Borç Ödemesi", "Maaş Geliri",
   "Abonelikler", "Diğer Giderler", "Diğer Gelirler")

   KRİTİK: Aşağıdaki açıklamaları gördüğünde kategori KESİNLİKLE "Kredi/Borç Ödemesi" olmalı:
   "Konut Kredisi Taksiti", "Taşıt Kredisi Taksiti", "Esnaf Kredisi Taksiti",
   "Kredi Taksiti", "İhtiyaç Kredisi Taksiti", "Tüketici Kredisi Taksiti",
   "Bireysel Kredi Taksiti", "KMH Taksiti", "Mortgage Taksiti",
   "kredi", "taksit", "mortgage", "loan payment" — bunları içeren tüm işlemler
   "Kredi/Borç Ödemesi" kategorisine girer. Hiçbir zaman "Diğer Giderler" yapma.
2. Abonelik olan harcamaları kesinlikle tespit et ve abonelik_mi=true yap.
   Şu servisler KESİNLİKLE abonelik: Netflix, Spotify, YouTube Premium, Amazon Prime, Disney+,
   Exxen, BluTV, Gain, MUBI, Apple TV+, Deezer, Tidal, ChatGPT Plus, Copilot, Canva, Adobe,
   Dropbox, iCloud, Google One, PlayStation Plus, Xbox Game Pass, internet faturası, telefon faturası.
   Bu servisler "Abonelikler" kategorisine girer.
3. Her kategori için toplam tutarı ve işlem sayısını hesapla

Aşağıdaki JSON formatında yanıt ver:
[
  {{
    "kategori_adi": "Market Alışverişi",
    "toplam_tutar": 2450.75,
    "islem_sayisi": 8,
    "abonelik_mi": false,
    "islemler": [
      {{
        "tarih": "2025-01-05",
        "tutar": -450.00,
        "aciklama": "Migros Market",
        "banka": "Ziraat",
        "tur": "gider",
        "kategori": "Market Alışverişi"
      }}
    ]
  }}
]

Sadece geçerli JSON döndür. Markdown veya açıklama ekleme.
"""

            response = await self._generate_with_retry(prompt)
            yanit_metni = self._json_temizle(response.text)
            kategoriler = json.loads(yanit_metni)

            # Tip güvenliği
            temiz_kategoriler = []
            for kategori in kategoriler:
                if isinstance(kategori, dict) and "kategori_adi" in kategori:
                    temiz_kategoriler.append({
                        "kategori_adi": str(kategori.get("kategori_adi", "")),
                        "toplam_tutar": float(kategori.get("toplam_tutar", 0)),
                        "islem_sayisi": int(kategori.get("islem_sayisi", 0)),
                        "abonelik_mi": bool(kategori.get("abonelik_mi", False)),
                        "islemler": kategori.get("islemler", [])
                    })

            return temiz_kategoriler

        except json.JSONDecodeError as e:
            raise ValueError(f"Kategorizasyon için geçersiz JSON: {e}")
        except Exception as e:
            raise RuntimeError(f"Kategorizasyon hatası: {e}")

    async def analiz_et(
        self,
        kategoriler: list,
        borc_listesi: list,
        gelir: float,
        tcmb: Optional[dict] = None,
        profil: Optional[dict] = None
    ) -> dict:
        """
        Finansal analiz yapar: nakit akışı, borç sınıflandırması, skor hesaplar.

        Args:
            kategoriler: Kategorize edilmiş harcamalar
            borc_listesi: Borç kalemleri listesi
            gelir: Toplam aylık gelir
            tcmb: TCMB makro verileri
            profil: Kullanıcı profili

        Returns:
            dict: FinancialSnapshot formatında analiz sonucu
        """
        try:
            baglamlar = self._rag_baglamlari_olustur(tcmb, profil)
            kategoriler_json = json.dumps(kategoriler, ensure_ascii=False, indent=2)
            borc_json = json.dumps(borc_listesi, ensure_ascii=False, indent=2)
            tcmb_json = json.dumps(tcmb, ensure_ascii=False) if tcmb else "{}"

            toplam_gider = sum(abs(k.get("toplam_tutar", 0)) for k in kategoriler
                               if k.get("toplam_tutar", 0) < 0)

            prompt = f"""
{baglamlar}

Sen deneyimli bir kişisel finans danışmanısın. Aşağıdaki finansal verileri analiz et.

AYLIK GELİR: {gelir:,.2f} TL
TOPLAM GİDER: {toplam_gider:,.2f} TL
NAKİT AKIŞI: {gelir - toplam_gider:,.2f} TL

KATEGORİLER:
{kategoriler_json}

BORÇ LİSTESİ:
{borc_json}

TCMB VERİLERİ:
{tcmb_json}

Görevler:
1. Her borç için siniflandirma yap:
   - "stratejik": Yatırım amaçlı, düşük faizli, değer yaratan borçlar (konut, eğitim)
   - "gri": Orta vadeli, zorunlu ama riskli borçlar (araç, beyaz eşya)
   - "kotu": Yüksek faizli, tüketim amaçlı borçlar (kredi kartı, ihtiyaç kredisi)
2. Finansal skor hesapla (0-100):
   - Nakit akışı pozitifliği (30 puan)
   - Borç/gelir oranı (30 puan)
   - Harcama çeşitliliği ve kontrolü (20 puan)
   - Acil fon / tasarruf durumu (20 puan)
   Enflasyon ortamını (%{tcmb.get('tufe', 65) if tcmb else 65}) dikkate al.

Aşağıdaki JSON formatında yanıt ver:
{{
  "finansal_skor": 72,
  "toplam_gider": {toplam_gider:.2f},
  "nakit_akisi": {gelir - toplam_gider:.2f},
  "borc_listesi": [
    {{
      "aciklama": "Konut Kredisi",
      "ana_para": 450000.00,
      "faiz_orani": 2.89,
      "kalan_taksit": 180,
      "aylik_odeme": 4200.00,
      "siniflandirma": "stratejik"
    }}
  ],
  "skor_aciklamasi": "Nakit akışınız pozitif ancak borç yükü yüksek."
}}

Sadece geçerli JSON döndür.
"""

            response = await self._generate_with_retry(prompt)
            yanit_metni = self._json_temizle(response.text)
            analiz = json.loads(yanit_metni)

            return analiz

        except json.JSONDecodeError as e:
            raise ValueError(f"Analiz için geçersiz JSON: {e}")
        except Exception as e:
            raise RuntimeError(f"Analiz hatası: {e}")

    async def oneri_uret(
        self,
        snapshot: dict,
        profil: Optional[dict] = None,
        tcmb: Optional[dict] = None
    ) -> dict:
        """
        Finansal duruma göre 3 somut aksiyon önerisi ve borç çıkış planı üretir.

        Args:
            snapshot: FinancialSnapshot verisi
            profil: Kullanıcı profili
            tcmb: TCMB makro verileri

        Returns:
            dict: {"oneriler": [...], "borc_cikis_plani": {...}}
        """
        try:
            baglamlar = self._rag_baglamlari_olustur(tcmb, profil)

            # Snapshot'ı özetleyerek gönder — tüm işlem listesi değil
            # Bu Gemini'ye giden token sayısını dramatik düşürür
            gelir = float(snapshot.get("gelir", 0))
            gider = float(snapshot.get("toplam_gider", 0))
            nakit = float(snapshot.get("nakit_akisi", 0))
            skor = snapshot.get("finansal_skor", 0)
            ay = snapshot.get("ay", "")

            # Kategori özeti (sadece ad + tutar, işlemler hariç)
            kat_ozet = []
            for k in snapshot.get("kategoriler", []):
                tutar = abs(float(k.get("toplam_tutar", 0)))
                if tutar > 100:
                    ab = " (ABONELİK)" if k.get("abonelik_mi") else ""
                    kat_ozet.append(f"- {k.get('kategori_adi','?')}: {tutar:,.0f} TL{ab}")

            # Borç özeti
            borc_listesi = snapshot.get("borc_listesi", [])
            toplam_borc = sum(float(b.get("ana_para", 0)) for b in borc_listesi)
            borc_ozet = []
            for b in borc_listesi:
                borc_ozet.append(
                    f"- {b.get('aciklama','?')}: {float(b.get('aylik_odeme',0)):,.0f} TL/ay "
                    f"[{b.get('siniflandirma','gri')}]"
                )

            borclu = toplam_borc > 0
            borc_yontemi = "Avalanche (yüksek faizden başla)" if len(borc_listesi) > 1 else "Minimum + ekstra ödeme"

            prompt = f"""
{baglamlar}

Sen empatik bir kişisel finans koçusun. Aşağıdaki finansal durumu değerlendirip
TAM OLARAK 3 adet somut, uygulanabilir Türkçe aksiyon önerisi sun.

FİNANSAL ÖZET ({ay}):
- Aylık Gelir: {gelir:,.0f} TL
- Aylık Gider: {gider:,.0f} TL
- Nakit Akışı: {nakit:+,.0f} TL
- Finansal Skor: {skor}/100

HARCAMA KATEGORİLERİ:
{chr(10).join(kat_ozet) if kat_ozet else "- Veri yok"}

BORÇ LİSTESİ:
{chr(10).join(borc_ozet) if borc_ozet else "- Borç yok"}
Toplam borç: {toplam_borc:,.0f} TL
{"Önerilen yöntem: " + borc_yontemi if borclu else ""}

TALİMATLAR:
- Tam olarak 3 öneri üret (Yüksek, Orta, Düşük öncelikli birer tane)
- Gerçek rakamları kullan (TL miktarlarını belirt)
- Empatik, Türkçe dil — "Sevgili danışanım" gibi nezaket kalıpları KULLANMA
- Her öneri için max 4 madde — somut, uygulanabilir adımlar
- Maddelerde * işareti değil • veya düz cümle kullan
- Enflasyon (%{tcmb.get('tufe', 65) if tcmb else 65}) bağlamında düşün

Aşağıdaki JSON formatında yanıt ver (sadece JSON, başka hiçbir şey yazma):
{{
  "oneriler": [
    {{
      "id": "oneri_1",
      "ana_fikir": "Online alışverişini yarıya indir",
      "oncelik": "Yüksek",
      "kazanim": "Aylık 3.290 TL tasarruf",
      "kazanim_tutari": 3290,
      "maddeler": [
        "Bu ay online alışverişe 6.580 TL harcadın, geçen aya göre %40 fazla.",
        "Sadece ihtiyaç listenizdeki ürünleri al, anlık kararlardan kaçın.",
        "Alışveriş sepetini 24 saat beklet, gerçekten lazım mı diye sor.",
        "Bu tasarrufla 2 ay içinde bir taksitini kapatabilirsin."
      ]
    }},
    {{
      "id": "oneri_2",
      "ana_fikir": "Kullanılmayan abonelikleri iptal et",
      "oncelik": "Orta",
      "kazanim": "Aylık 450 TL tasarruf",
      "kazanim_tutari": 450,
      "maddeler": [
        "Aboneliklerine bu ay toplam 450 TL harcadın.",
        "Ayda 1-2 kez kullandığın platformları askıya al.",
        "Yılda 5.400 TL tasarruf eder, bu bir taksit ödemesine eşit."
      ]
    }},
    {{
      "id": "oneri_3",
      "ana_fikir": "Acil fon oluştur",
      "oncelik": "Düşük",
      "kazanim": "3 aylık güvence",
      "kazanim_tutari": 0,
      "maddeler": [
        "Şu an 0 TL acil fonun var.",
        "Her ay 500 TL ayırırsan 6 ayda temel güvenceye ulaşırsın.",
        "Bu fon, beklenmedik gider geldiğinde kredi kartına sarılmayı önler."
      ]
    }}
  ],
  "borc_cikis_plani": {{"yontem": "avalanche", "toplam_borc": {toplam_borc:.0f}, "aylik_ekstra_odeme": 1000, "tahmini_bitis_ay": "2027-06", "adimlar": []}}
}}

Borç yoksa borc_cikis_plani null olsun. Sadece JSON döndür.
"""

            print(f"[GEMINI] oneri_uret prompt boyutu: {len(prompt)} karakter")
            response = await self._generate_with_retry(prompt)
            yanit_ham = response.text if response.text else ""
            print(f"[GEMINI] oneri_uret yanıt boyutu: {len(yanit_ham)} karakter")
            print(f"[GEMINI] İlk 200 karakter: {yanit_ham[:200]}")

            yanit_metni = self._json_temizle(yanit_ham)

            if not yanit_metni:
                raise ValueError("Gemini boş yanıt döndürdü")

            sonuc = json.loads(yanit_metni)

            # oneriler listesi en az 1 öneri içermeli
            if not sonuc.get("oneriler"):
                raise ValueError("Gemini öneri listesi boş döndürdü")

            return sonuc

        except json.JSONDecodeError as e:
            raise ValueError(f"Öneri üretme için geçersiz JSON: {e}")
        except Exception as e:
            raise RuntimeError(f"Öneri üretme hatası: {e}")

    async def chat_yanit(
        self,
        mesaj: str,
        snapshot: Optional[dict] = None,
        profil: Optional[dict] = None
    ) -> str:
        """
        Kullanıcının finansal verilerine bakarak empatik Türkçe yanıt üretir.

        Args:
            mesaj: Kullanıcının sorusu veya mesajı
            snapshot: Kullanıcının mevcut FinancialSnapshot verisi
            profil: Kullanıcı profili

        Returns:
            str: Empatik ve kişiselleştirilmiş Türkçe yanıt
        """
        try:
            baglamlar = self._rag_baglamlari_olustur(None, profil)

            # Snapshot'tan tam finansal bağlamı oluştur
            finansal_ozet = ""
            if snapshot:
                gelir = snapshot.get('gelir', 0)
                gider = snapshot.get('toplam_gider', 0)
                nakit = snapshot.get('nakit_akisi', 0)
                skor = snapshot.get('finansal_skor', 0)
                ay = snapshot.get('ay', 'Bilinmiyor')

                # Kategori özeti
                kategori_satirlari = []
                for k in snapshot.get('kategoriler', []):
                    tutar = abs(float(k.get('toplam_tutar', 0)))
                    if tutar > 0:
                        abonelik = " (ABONELİK)" if k.get('abonelik_mi') else ""
                        kategori_satirlari.append(
                            f"  - {k.get('kategori_adi', '?')}: {tutar:,.0f} TL{abonelik}"
                        )
                kategoriler_metni = "\n".join(kategori_satirlari) if kategori_satirlari else "  (veri yok)"

                # Borç özeti
                borc_satirlari = []
                for b in snapshot.get('borc_listesi', []):
                    sinif = b.get('siniflandirma', 'gri').upper()
                    borc_satirlari.append(
                        f"  - {b.get('aciklama', '?')}: {b.get('aylik_odeme', 0):,.0f} TL/ay "
                        f"[{sinif}]"
                    )
                borclar_metni = "\n".join(borc_satirlari) if borc_satirlari else "  (borç yok)"

                # Öneri özeti
                oneri_satirlari = []
                for o in snapshot.get('oneriler', []):
                    oneri_satirlari.append(f"  - {o.get('baslik', '')}: {o.get('aciklama', '')}")
                oneriler_metni = "\n".join(oneri_satirlari) if oneri_satirlari else "  (öneri yok)"

                finansal_ozet = f"""
KULLANICININ DETAYLI FİNANSAL DURUMU ({ay} dönemi):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Aylık Gelir   : {gelir:,.0f} TL
Aylık Gider   : {gider:,.0f} TL
Nakit Akışı   : {nakit:+,.0f} TL  {'✓ Pozitif' if nakit >= 0 else '✗ Negatif'}
Finansal Skor : {skor}/100

HARCAMA KATEGORİLERİ:
{kategoriler_metni}

BORÇ LİSTESİ:
{borclar_metni}

MEVCUT ÖNERİLER:
{oneriler_metni}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Yukarıdaki VERİLERE BAKARAK kullanıcının sorusunu yanıtla.
"Verilerinizi göremiyorum" veya "bilgiye erişimim yok" deme — tüm veriler yukarıda.
"""

            prompt = f"""
{baglamlar}
{finansal_ozet}
Sen ParaPusula'nın empatik, anlayışlı ve pratik finansal asistanısın.
Kullanıcının gerçek verilerine erişimin var, kişiselleştirilmiş yanıtlar veriyorsun.

KULLANICI MESAJI: {mesaj}

YANIT KURALLARI:
- Türkçe yaz, samimi ve sıcak ol
- Kullanıcının gerçek rakamlarını yanıtta kullan (örn: "Bu ay {gider if snapshot else 'X'} TL harcadın")
- Somut, uygulanabilir adımlar öner
- Yargılamadan, motive ederek konuş
- 2-4 paragraf, net ve anlaşılır
- Emojilerden kaçın, profesyonel ama sıcak ol
"""

            response = await self._generate_with_retry(prompt)
            return response.text.strip()

        except Exception as e:
            raise RuntimeError(f"Sohbet yanıtı üretme hatası: {e}")


# Singleton instance - tüm modüller bunu import eder
gemini_service = GeminiService()
