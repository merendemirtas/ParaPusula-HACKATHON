"""
ParaPusula - PDF Agent
LangGraph pipeline'ının ilk adımı: PDF'ten işlemleri çıkarır.
Ziraat Bankası ve Halkbank formatlarını destekler.
"""

from models.schemas import PipelineState
from services.gemini_service import gemini_service


def banka_tespit_et(file_content: bytes) -> str:
    """
    PDF içeriğinden banka adını otomatik tespit eder.
    İçeriğe bakar; bulamazsa 'Ziraat' varsayar.

    # KARAR: PDF bytes'ını decode edip içinde anahtar kelime arıyoruz.
    # Encoding hataları için errors='ignore' kullanıyoruz.
    """
    icerik = file_content.decode("utf-8", errors="ignore").lower()

    if "halkbank" in icerik or "halk bank" in icerik or "halk bankası" in icerik:
        return "Halkbank"
    if "ziraat" in icerik or "t.c. ziraat" in icerik:
        return "Ziraat"

    # İkincil kontrol: yaygın başlık metinleri
    if "halk" in icerik and "bank" in icerik:
        return "Halkbank"

    # Tespit edilemezse Ziraat varsay
    print("[PDF Agent] Banka tespit edilemedi, varsayılan: Ziraat")
    return "Ziraat"


ZIRAAT_PROMPT = """
Ziraat Bankası hesap ekstresi analiz uzmanısın.

ZIRAAT BANKASI EKSTRESİ FORMAT BİLGİSİ:
- Tarih formatı: GG/AA/YYYY (örn: 15/01/2025)
- Tutar formatı: 1.234,56 (nokta = binlik ayırıcı, virgül = ondalık)
- Gelir/gider ayrımı: "ALACAK" sütunu gelir, "BORÇ" sütunu gideri gösterir
- İşlem açıklaması genellikle 3. sütunda yer alır

TÜM işlemleri çıkar. Her işlem için:
- tarih: "YYYY-MM-DD" formatına çevir (örn: "2025-01-15")
- tutar: Pozitif sayı (gelir için +, gider için -)
- aciklama: Aşağıdaki KRİTİK KURALA göre doldur (bak)
- banka: "Ziraat"
- tur: "gelir" (ALACAK) veya "gider" (BORÇ)
- faiz_orani: Açıklamada yıllık faiz oranı yazıyorsa rakam olarak yaz, yoksa null

KRİTİK KURAL — Kredi Ödemeleri:
Aşağıdaki ifadelerden herhangi birini görüyorsan, aciklama alanını OLDUĞU GİBİ yaz (kısaltma yapma,
değiştirme). Bu ifadeler borç taksiti olduğunu gösterir:
  "Konut Kredisi Taksiti"
  "Taşıt Kredisi Taksiti"
  "Esnaf Kredisi Taksiti"
  "Kredi Taksiti"
  "İhtiyaç Kredisi Taksiti"
  "Tüketici Kredisi Taksiti"
  "Bireysel Kredi Taksiti"
  "KMH Taksiti"
  "Mortgage Taksiti"

Faiz çıkarma örneği:
- "Konut Kredisi Taksiti (%30 Yıllık Faizli)" → aciklama: "Konut Kredisi Taksiti", faiz_orani: 30.0
- "Esnaf Kredisi Taksiti - %52 Faiz"          → aciklama: "Esnaf Kredisi Taksiti", faiz_orani: 52.0
- "Taşıt Kredisi Taksiti"                     → aciklama: "Taşıt Kredisi Taksiti", faiz_orani: null
"""

HALKBANK_PROMPT = """
Halkbank hesap ekstresi analiz uzmanısın.

HALKBANK EKSTRESİ FORMAT BİLGİSİ:
- Tarih formatı: GG.AA.YYYY (örn: 15.01.2025)
- Tutar formatı: 1.234,56 (nokta = binlik ayırıcı, virgül = ondalık)
- Gelir/gider ayrımı: tutarın önündeki + işareti gelir, - işareti gideri gösterir
- Açıklama sütununda işlem detayı yer alır
- "Çıkış" sütunu gider, "Giriş" sütunu gelirdir

TÜM işlemleri çıkar. Her işlem için:
- tarih: "YYYY-MM-DD" formatına çevir (örn: "2025-01-15")
- tutar: Pozitif sayı (gelir için +, gider için -)
- aciklama: Kredi taksit açıklamalarını OLDUĞU GİBİ yaz (bak: KRİTİK KURAL)
- banka: "Halkbank"
- tur: "gelir" veya "gider"
- faiz_orani: Açıklamada yıllık faiz oranı yazıyorsa rakam olarak yaz, yoksa null

KRİTİK KURAL — Kredi Ödemeleri:
"Konut Kredisi Taksiti", "Taşıt Kredisi Taksiti", "Esnaf Kredisi Taksiti",
"Kredi Taksiti", "İhtiyaç Kredisi Taksiti", "Tüketici Kredisi Taksiti",
"Bireysel Kredi Taksiti", "KMH Taksiti" — bunları OLDUĞU GİBİ yaz.
Faiz varsa faiz_orani alanına yaz.
"""

JSON_FORMAT_TALIMATI = """
Aşağıdaki JSON formatında yanıt ver (sadece JSON, başka hiçbir şey yazma):
[
  {
    "tarih": "2025-01-05",
    "tutar": -2850.00,
    "aciklama": "Konut Kredisi Taksiti",
    "banka": "BANKA_ADI",
    "tur": "gider",
    "faiz_orani": 30.0
  },
  {
    "tarih": "2025-01-05",
    "tutar": -450.00,
    "aciklama": "Migros Market Alışverişi",
    "banka": "BANKA_ADI",
    "tur": "gider",
    "faiz_orani": null
  },
  {
    "tarih": "2025-01-01",
    "tutar": 25000.00,
    "aciklama": "Maaş Ödemesi",
    "banka": "BANKA_ADI",
    "tur": "gelir",
    "faiz_orani": null
  }
]
"""


async def pdf_agent_node(state: PipelineState) -> PipelineState:
    """
    Pipeline'ın PDF okuma adımı.
    - Banka tipini state veya PDF içeriğinden tespit eder
    - Banka-spesifik prompt ile Gemini'ye gönderir
    - ham_islemler listesini günceller
    """
    try:
        pdf_yolu = state.get("pdf_dosya_yolu", "")
        banka = state.get("banka", "")
        tcmb_verisi = state.get("tcmb_verisi")
        kullanici_profili = state.get("kullanici_profili")

        if not pdf_yolu:
            state["hata"] = "PDF dosya yolu belirtilmemiş"
            state["mevcut_adim"] = "pdf_hata"
            return state

        # PDF dosyasını bytes olarak oku
        with open(pdf_yolu, "rb") as f:
            file_content = f.read()

        if len(file_content) == 0:
            state["hata"] = "PDF dosyası boş"
            state["mevcut_adim"] = "pdf_hata"
            return state

        # Banka belirsizse PDF içeriğinden otomatik tespit et
        if not banka or banka.lower() not in ["ziraat", "halkbank"]:
            banka = banka_tespit_et(file_content)
            state["banka"] = banka

        # Banka tipine göre özel prompt template seç
        if banka.lower() == "halkbank":
            banka_prompt = HALKBANK_PROMPT
        else:
            banka_prompt = ZIRAAT_PROMPT

        # JSON format talimatındaki BANKA_ADI yerine gerçek banka adını koy
        json_talimati = JSON_FORMAT_TALIMATI.replace("BANKA_ADI", banka)
        tam_prompt = banka_prompt + "\n" + json_talimati

        print(f"\n[PDF Agent] ─── Prompt gönderiliyor ({'Ziraat' if banka != 'Halkbank' else 'Halkbank'}) ───")
        print(f"[PDF Agent] Kredi anahtar kelimeleri:")
        print(f"[PDF Agent]   'Konut Kredisi Taksiti', 'Taşıt Kredisi Taksiti',")
        print(f"[PDF Agent]   'Esnaf Kredisi Taksiti', 'Kredi Taksiti',")
        print(f"[PDF Agent]   'İhtiyaç Kredisi Taksiti', 'Tüketici Kredisi Taksiti'")
        print(f"[PDF Agent] Faiz çıkarımı: açıklamada %NN varsa → faiz_orani")

        # Gemini üzerinden işlemleri çıkar
        ham_islemler = await gemini_service.pdf_icerik_cikar(
            file_content=file_content,
            banka=banka,
            prompt_override=tam_prompt,
            tcmb=tcmb_verisi,
            profil=kullanici_profili
        )

        print(f"\n[PDF Agent] ─── {len(ham_islemler)} işlem çıkarıldı — Banka: {banka} ───")
        kredi_islemleri = [i for i in ham_islemler
                           if any(k in i.get("aciklama", "").lower()
                                  for k in ["kredi", "taksit", "mortgage", "kmh"])]
        print(f"[PDF Agent] Kredi ödemesi tespit edilenler ({len(kredi_islemleri)} adet):")
        for i in kredi_islemleri:
            faiz_str = f" | faiz_orani: %{i.get('faiz_orani')}" if i.get("faiz_orani") else ""
            print(f"[PDF Agent]   {i.get('tarih')} | {i.get('aciklama')} | {i.get('tutar')} TL{faiz_str}")
        if not kredi_islemleri:
            print(f"[PDF Agent]   (hiç kredi ödemesi bulunamadı — açıklama listesi:)")
            for i in ham_islemler[:10]:
                print(f"[PDF Agent]   → '{i.get('aciklama')}'")
        print(f"[PDF Agent] ────────────────────────────────────────────\n")

        state["ham_islemler"] = ham_islemler
        state["mevcut_adim"] = "pdf_tamamlandi"
        state["hata"] = None

    except FileNotFoundError as e:
        state["hata"] = f"PDF dosyası bulunamadı: {e}"
        state["mevcut_adim"] = "pdf_hata"
    except Exception as e:
        state["hata"] = f"PDF işleme hatası: {e}"
        state["mevcut_adim"] = "pdf_hata"

    return state
