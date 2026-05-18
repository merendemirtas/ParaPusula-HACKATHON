# ParaPusula 🧭

**AI destekli kişisel finansal asistan** — BTK Akademi Hackathon 2026

Banka ekstrenizi yükleyin, AI saniyeler içinde finansal haritanızı çıkarsın. Borç sınıflandırması, harcama analizi, avalanche borç ödeme planı ve kişisel öneri üretimi tek sistemde.

---

## Kurulum

### Gereksinimler

- Python 3.11+
- Node.js 18+
- Firebase projesi (Firestore + Authentication)
- Google Gemini API anahtarı

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# .env dosyasını oluştur
cp .env.example .env
# Gerekli anahtarları .env dosyasına ekle

python main.py
# → http://localhost:8000
# → Swagger UI: http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Backend | FastAPI + Python 3.11 |
| AI Pipeline | LangGraph + Gemini 2.5 Flash |
| Veritabanı | Firebase Firestore |
| Kimlik Doğrulama | Firebase Authentication |
| Makroekonomik Veri | TCMB EVDS API |
| Frontend | React 18 + Vite |
| Grafikler | Recharts |
| Stil | CSS Custom Properties (Design System) |

---

## Özellikler

- **PDF Okuma** — Ziraat ve Halkbank banka ekstreleri desteklenir
- **AI Analiz** — 5 aşamalı LangGraph pipeline (PDF → Kategorizasyon → Veri zenginleştirme → Analiz → Öneri)
- **Finansal Skor** — 0-100 arası sağlık skoru (Kritik / Dikkat / İyi / Mükemmel)
- **Borç Haritası** — TCMB verisine göre stratejik/gri/riskli sınıflandırma
- **Avalanche Planı** — Aylık detaylı borç ödeme tablosu
- **Harcama Analizi** — Kategorili grafik + işlem detay modal
- **Finansal Asistan** — Ekstrene özel soru-cevap (Gemini 2.5 Flash)
- **Türkçe Arayüz** — Tamamen Türkçe, mobil uyumlu

---

## Demo Akışı

1. `http://localhost:5173` → Kayıt ol
2. Onboarding'i tamamla (4 soru)
3. PDF Yükle → `Ziraat_Ekstre_Ornek.pdf` seç
4. Dashboard'da skor ve grafikleri incele
5. Borç Haritası → Aylık ödeme tablosunu gör
6. Harcamalar → Kategoriye tıkla, işlem detayı aç
7. Asistan → "Bu ay neye en çok harcadım?" diye sor

---

## Çevre Değişkenleri

```env
GEMINI_API_KEY=...
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...
CORS_ORIGINS=http://localhost:5173
```

---

## Hackathon Notları

- TCMB EVDS entegrasyonu: gerçek API auth karmaşık olduğundan simüle fallback değerler kullanılır (TÜFE=65, KFE=34, azami_faiz=4.5) — Firestore'a cache'lenir
- Gemini 429 hatası: exponential backoff (1s, 2s, 4s) + günlük kota kontrolü
- Borç faiz hesabı: yıllık % / 12 / 100 = aylık decimal (Avalanche algoritması)

---

*2026 · Veriler uçtan uca şifreli işlenir*
