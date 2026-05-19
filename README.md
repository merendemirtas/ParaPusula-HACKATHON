# 🧭 ParaPusula

> **Yapay Zeka Destekli Kişisel Finansal Özgürlük Asistanı**
> BTK Akademi Hackathon 2026

[![Python](https://img.shields.io/badge/Python-3.11+-356B59?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-356B59?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-356B59?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-356B59?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-356B59?style=flat-square&logo=firebase&logoColor=white)](https://firebase.google.com)

---

## 📌 Ne Yapar?

ParaPusula, Türkiye'de yaşayan bireylerin banka ekstrelerini yükleyerek finansal durumlarını anlık olarak görmelerini, borç tuzaklarını tespit etmelerini ve kişiselleştirilmiş çıkış planı oluşturmalarını sağlar.

Banka API'si gerektirmez. PDF ekstresi yeterlidir.

---

## ✨ Öne Çıkan Özellikler

| Özellik | Açıklama |
|---|---|
| 🤖 Multi-Agent Pipeline | LangGraph ile 6 ajan sırayla çalışır |
| 📄 PDF Okuma | Gemini File API — Ziraat + Halkbank |
| 📊 Finansal Sağlık Skoru | 5 parametreli deterministik algoritma |
| 💳 Borç Sınıflandırması | Stratejik / Yönetilebilir / Kritik |
| 🏦 TCMB Entegrasyonu | Canlı TÜFE, KFE, azami faiz verisi |
| 🔮 Senaryo Simülatörü | "Arabamı satsam ne olur?" |
| ⭐ Abonelik Puanlama | 1-5 yıldız, AI önerilerine yansır |
| 🎯 Birikim Hedefi | Fotoğraflı hedef kartı + donut chart |
| ✨ "Vay Be" Anı | İlk analizde çarpıcı özet ekranı |
| 🌙 Dark / Light Mode | Tam tema desteği |

---

## 🛠️ Teknoloji Yığını

### Backend
```
FastAPI (Python 3.11+)     — REST API
LangGraph + LangChain      — Multi-agent pipeline
Gemini 2.5 Flash           — AI motoru
Gemini File API            — PDF okuma
Firebase Firestore         — Veritabanı
Firebase Auth              — Kimlik doğrulama
TCMB EVDS API              — Ekonomik veri
evds                       — TCMB Python kütüphanesi
```

### Frontend
```
React (Vite)               — SPA framework
Framer Motion              — Animasyonlar
Recharts                   — Grafikler
Tailwind CSS               — Stil sistemi
lucide-react               — İkonlar
```

---

## 🚀 Kurulum

### Gereksinimler

- Python 3.11+
- Node.js 18+
- Firebase projesi (Firestore + Auth aktif)
- Gemini API key
- TCMB EVDS API key

### 1. Repoyu klonla

```bash
git clone https://github.com/kullanici/parapusula.git
cd parapusula
```

### 2. Backend kurulumu

```bash
cd backend
pip install -r requirements.txt
```

`.env` dosyası oluştur:

```env
GEMINI_API_KEY=your_gemini_api_key
TCMB_API_KEY=your_tcmb_api_key
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY_ID=your_key_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your_client_id
CORS_ORIGINS=http://localhost:5173
```

Backend'i başlat:

```bash
uvicorn main:app --reload
```

API: `http://localhost:8000`
Dokümantasyon: `http://localhost:8000/docs`

### 3. Frontend kurulumu

```bash
cd frontend
npm install
```

`.env` dosyası oluştur:

```env
VITE_API_URL=http://localhost:8000
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
```

Frontend'i başlat:

```bash
npm run dev
```

Uygulama: `http://localhost:5173`

---

## 📁 Proje Yapısı

```
parapusula/
├── backend/
│   ├── main.py                      # FastAPI uygulaması
│   ├── config.py                    # Ortam değişkenleri
│   ├── requirements.txt
│   ├── agents/
│   │   ├── pipeline.py              # LangGraph DAG
│   │   ├── pdf_agent.py             # PDF okuma
│   │   ├── categorization_agent.py  # Harcama kategorizasyonu
│   │   ├── enrichment_agent.py      # TCMB veri zenginleştirme
│   │   ├── analiz_agent.py          # Finansal analiz + skor
│   │   └── recommendation_agent.py  # Öneri + borç planı
│   ├── routers/
│   │   ├── upload.py                # PDF yükleme + streaming
│   │   ├── analysis.py              # Analiz endpoint'leri
│   │   ├── chat.py                  # Sohbet asistanı
│   │   ├── goals.py                 # Birikim hedefleri
│   │   └── simulator.py             # Senaryo simülatörü
│   ├── services/
│   │   ├── gemini_service.py        # Gemini API wrapper
│   │   ├── firebase_service.py      # Firestore CRUD
│   │   └── tcmb_service.py          # TCMB EVDS + cache
│   └── models/
│       ├── schemas.py               # Pydantic modeller
│       └── state.py                 # LangGraph state
└── frontend/
    └── src/
        ├── pages/
        │   ├── Dashboard.jsx        # Anasayfa
        │   ├── Expenses.jsx         # Harcamalar
        │   ├── DebtMap.jsx          # Borç Haritası
        │   ├── Simulator.jsx        # Senaryo Simülatörü
        │   ├── Assistant.jsx        # Sohbet Asistanı
        │   ├── Insight.jsx          # "Vay Be" anı
        │   ├── Upload.jsx           # PDF yükleme
        │   └── Onboarding.jsx       # Kullanıcı profili
        ├── components/
        │   ├── Navbar.jsx
        │   ├── ProgressPipeline.jsx
        │   └── ...
        ├── context/
        │   └── ThemeContext.jsx      # Dark/Light mode
        └── services/
            └── api.js               # Backend API çağrıları
```

---

## 🔄 Agent Pipeline

```
PDF Yüklenir
     ↓
PDF Agent          → İşlem listesi çıkarır (tarih, tutar, açıklama)
     ↓
Kategorizasyon     → 12 kategoriye ayırır, abonelikleri tespit eder
     ↓
Zenginleştirme     → TCMB: TÜFE %32.37, KFE %31.66, Azami Faiz %61.69
     ↓
Analiz             → Nakit akışı, borç haritası, finansal skor (0-100)
     ↓
Öneri              → 3 aksiyon, Avalanche borç planı
     ↓
Firestore          → Snapshot kaydedilir
     ↓
Frontend           → Dashboard + "Vay Be" anı
```

**Streaming:** Her agent tamamlandığında frontend'e anlık bildirim gönderilir.

---

## 🏦 TCMB Veri Entegrasyonu

```python
# Canlı ekonomik veri — evds kütüphanesi
from evds import evdsAPI

evds = evdsAPI(api_key)

# Çekilen seriler:
# TP.FG.J0   → TÜFE (Yıllık % değişim)
# TP.HKFE02  → KFE  (Konut Fiyat Endeksi)
# TP.KTF10   → Azami tüketici kredisi faizi
```

**Cache-first:** Veriler günlük Firestore'a yazılır. API erişilemezse fallback değerler devreye girer.

---

## 💡 Borç Sınıflandırma Mantığı

```python
def siniflandir(borc_turu, faiz_yillik, tufe, kfe):
    if borc_turu == "konut" and faiz_yillik < kfe:
        return "STRATEJİK"    # Eviniz borçtan hızlı değerleniyor
    elif faiz_yillik < tufe:
        return "YÖNETİLEBİLİR"  # Enflasyon borcu eritiyor
    else:
        return "KRİTİK"      # Faiz enflasyonun üzerinde
```

---

## 🔮 Senaryo Simülatörü

### Borç Hızlandırma
```
Seçilen borç + Ekstra ödeme tutarı
           ↓
Deterministik algoritma (amortizasyon formülü)
           ↓
• Erken bitiş tarihi
• Faiz tasarrufu
• Ay-ay karşılaştırma tablosu
• Gemini yorumu (1 çağrı)
```

### Büyük Karar
```
"Arabamı satsam ne olur?"
           ↓
Gemini ← Kullanıcının tam finansal snapshot'ı
           ↓
• Finansal etki (sayısal)
• Pratik uyarı
• 3 somut sonraki adım
• Şu an vs Yeni Senaryo tablosu
```

---

## 📱 Ekran Görüntüleri

| Dashboard (Light) | Dashboard (Dark) |
|---|---|
| Bento grid, finansal skor, birikim hedefi | Koyu yeşil tema, glassmorphism kartlar |

---

## 🌐 Deploy

### Railway (Önerilen)

**Backend:**
```bash
# Railway dashboard'dan GitHub repo bağla
# Root directory: backend
# Environment variables: .env içeriğini ekle
```

**Frontend:**
```bash
# Ayrı servis aç
# Root directory: frontend
# VITE_API_URL = Railway backend URL'i
```

**Firebase:**
```
Authentication → Settings → Authorized domains
→ Railway frontend URL'ini ekle
```

---

## 🧪 Test

```bash
# Backend API test
http://localhost:8000/docs

# Örnek PDF ekstresi
# /test-data/Ziraat_Ekstre_Nisan2026.pdf

# Demo akışı:
# 1. Kayıt ol
# 2. Onboarding'i tamamla
# 3. Test PDF yükle
# 4. "Vay Be" anını gör
# 5. Dashboard → Borç Haritası → Simülatör
```

---

## 👥 Kullanıcı Senaryoları

| Kullanıcı | Problem | Çözüm |
|---|---|---|
| **Zeynep, 24** | Maaş nereye gidiyor? | Harcama analizi + borç planı |
| **Murat, 38** | 3 bankada borç, tablo yok | Birleşik analiz + simülatör |
| **Selin, 31** | Düzensiz gelir paniği | Vergi karşılığı + sabit gider kalkanı |
| **Kerem, 29** | Para var ama çalışmıyor | Birikim hedefi + senaryo |

---

## Ekran Resimleri

<img width="1710" height="989" alt="Ekran Resmi 2026-05-19 23 18 10" src="https://github.com/user-attachments/assets/c251554c-32fe-4c52-8315-cbed11da2e7c" />

<img width="1710" height="989" alt="Ekran Resmi 2026-05-19 23 18 06" src="https://github.com/user-attachments/assets/727a3fac-3be1-4137-b92a-f7020514b898" />

<img width="1710" height="989" alt="Ekran Resmi 2026-05-19 23 18 25" src="https://github.com/user-attachments/assets/6fc4952b-86e9-4536-af05-20a8b952c116" />

<img width="1710" height="989" alt="Ekran Resmi 2026-05-19 23 18 31" src="https://github.com/user-attachments/assets/bb365aba-37ee-4bec-9468-fc3e74303254" />

<img width="1710" height="989" alt="Ekran Resmi 2026-05-19 23 18 45" src="https://github.com/user-attachments/assets/d8794545-da48-4f02-9d06-41514a97c48c" />

<img width="1710" height="989" alt="Ekran Resmi 2026-05-19 23 19 12" src="https://github.com/user-attachments/assets/0761a064-0025-4860-86c3-2fcb284120ed" />

<img width="1710" height="989" alt="Ekran Resmi 2026-05-19 23 19 35" src="https://github.com/user-attachments/assets/0f5d385f-4edf-474a-9940-5127efd9cc0a" />

<img width="1710" height="989" alt="Ekran Resmi 2026-05-19 23 19 38" src="https://github.com/user-attachments/assets/44697379-5a6c-4d74-93f9-e2c1fae3943e" />

<img width="1710" height="989" alt="Ekran Resmi 2026-05-19 23 20 22" src="https://github.com/user-attachments/assets/ef7a9e72-8d08-4672-b188-ec1ce0402aa2" />

---

## 📄 Lisans

Bu proje BTK Akademi Hackathon 2026 kapsamında geliştirilmiştir.

---

<div align="center">

**ParaPusula** · BTK Akademi Hackathon 2026

*Finansal özgürlüğe giden yolu birlikte buluyoruz.*

</div>
