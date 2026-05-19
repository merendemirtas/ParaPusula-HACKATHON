# ParaPusula

## Yapay Zeka Destekli Kişisel Finansal Özgürlük Asistanı

**BTK Akademi Hackathon 2026**

---

## Misyon

Türkiye'de yaşayan bireyleri borç tuzağından çıkarmak, harcamalarını anlamalarını sağlamak ve finansal hedeflerine ulaştırmak için hem ayna tutan hem kişiselleştirilmiş yol haritası sunan bir yapay zeka uygulaması.

**Türkiye'ye özel. Türkçe. Empatik. Banka API'si gerektirmez.**

---

## Problem

Türkiye'de milyonlarca insan hayat kalitesini artırmak için borçlanıyor — ancak her borç döngüsü stres seviyesini yükseltiyor ve finansal özgürlüğü daha da uzaklaştırıyor. Bu borç tuzağından çıkmanın önündeki en büyük engel bilgi eksikliği değil, **netlik eksikliğidir.**

```
Hayat pahalılaşır
      ↓
Kredi / borç alınır
      ↓
Faiz ödenir
      ↓
Daha çok çalışılması gerekir
      ↓
Hayat kalitesi düşer
      ↓
Tekrar borç alınır  ← döngü
```

---

## Rakip Analizi

| Özellik                  | Cleo / YNAB | Finart | **ParaPusula**   |
| ------------------------ | ----------- | ------ | ---------------- |
| Türkiye bankası desteği  | ❌          | ❌     | ✅ PDF ekstresi  |
| Türkçe tam destek        | ❌          | Kısmi  | ✅               |
| Borç tuzağını gösterme   | ❌          | ❌     | ✅ Özümüz bu     |
| TCMB verisi entegrasyonu | ❌          | ❌     | ✅ Canlı API     |
| Senaryo simülatörü       | Sınırlı     | ❌     | ✅               |
| Abonelik puanlama        | ❌          | ❌     | ✅ Özgün özellik |
| Stratejik borç analizi   | ❌          | ❌     | ✅ KFE + TÜFE    |
| Multi-agent pipeline     | ❌          | ❌     | ✅ LangGraph     |

---

## Teknoloji Yığını

### Yapay Zeka & Agent Katmanı

| Teknoloji            | Kullanım                                                 |
| -------------------- | -------------------------------------------------------- |
| **Gemini 2.5 Flash** | Ana AI motoru — PDF okuma, kategorizasyon, öneri üretimi |
| **Gemini File API**  | PDF ekstresi işleme                                      |
| **LangGraph**        | Multi-agent pipeline orkestrasyonu                       |
| **LangChain**        | Agent yönetimi ve RAG bağlamı                            |

### Backend

| Teknoloji                   | Kullanım                                     |
| --------------------------- | -------------------------------------------- |
| **FastAPI** (Python 3.11+)  | REST API, async/await                        |
| **Firebase Firestore**      | Veritabanı, kullanıcı verileri, snapshot'lar |
| **Firebase Auth**           | Email/şifre kimlik doğrulama                 |
| **TCMB EVDS API**           | Canlı ekonomik veri (TÜFE, KFE, azami faiz)  |
| **evds** Python kütüphanesi | TCMB entegrasyonu                            |

### Frontend

| Teknoloji         | Kullanım                                          |
| ----------------- | ------------------------------------------------- |
| **React** (Vite)  | SPA framework                                     |
| **Framer Motion** | Sayfa geçişleri, animasyonlar, micro-interactions |
| **Recharts**      | Grafikler (Line, RadialBar, Pie, Bar)             |
| **Tailwind CSS**  | Stil sistemi                                      |
| **lucide-react**  | İkon seti                                         |

### Altyapı & Geliştirme

| Teknoloji        | Kullanım                   |
| ---------------- | -------------------------- |
| **Claude Code**  | AI destekli kod geliştirme |
| **21st.dev MCP** | UI komponent kütüphanesi   |
| **Railway**      | Deploy & hosting           |

---

## Mimari — Multi-Agent Pipeline

```
Kullanıcı PDF yükler
        ↓
┌─────────────────────────────────────────────┐
│              LangGraph DAG                  │
│                                             │
│  PDF Agent                                  │
│  └─ Gemini File API ile ekstre okur         │
│  └─ Ziraat Bankası + Halkbank formatı       │
│  └─ İşlem listesi çıkarır                   │
│         ↓                                   │
│  Kategorizasyon Agent                       │
│  └─ 12 kategori: market, yemek, abonelik... │
│  └─ Abonelikleri otomatik tespit eder       │
│         ↓                                   │
│  Veri Zenginleştirme Agent                  │
│  └─ Firestore cache'den TCMB verisi okur    │
│  └─ Cache yoksa TCMB EVDS API'den çeker     │
│  └─ TÜFE, KFE, azami faiz                  │
│         ↓                                   │
│  Analiz Agent                               │
│  └─ Nakit akışı hesaplar                    │
│  └─ Borç haritası + sınıflandırma           │
│  └─ Finansal sağlık skoru (0-100)           │
│         ↓                                   │
│  Öneri Agent                                │
│  └─ 3 kişiselleştirilmiş aksiyon           │
│  └─ Borç çıkış planı (Avalanche)            │
│         ↓                                   │
│  Sohbet Agent                               │
│  └─ Kullanıcı verisine bakarak yanıtlar     │
└─────────────────────────────────────────────┘
        ↓
Streaming Progress UI → Dashboard
```

**Ajanlar arası iletişim:** LangGraph state yönetimi
**Her Gemini çağrısına RAG bağlamı eklenir:** TCMB verisi + kullanıcı profili

---

## TCMB Entegrasyonu

Türkiye'ye özel, gerçek zamanlı ekonomik veri:

| Veri                | Seri Kodu | Kullanım                 |
| ------------------- | --------- | ------------------------ |
| TÜFE (Yıllık)       | TP.FG.J0  | Borç sınıflandırma eşiği |
| Konut Fiyat Endeksi | TP.HKFE02 | Stratejik borç tespiti   |
| Azami Kredi Faizi   | TP.KTF10  | Faiz karşılaştırması     |

**Cache-first mimari:** Veriler günlük Firestore'a yazılır, her istekte API çağrısı yapılmaz.

---

## Finansal Sağlık Skoru

Deterministik algoritma — 5 parametre, 100 puan:

| Parametre        | Puan | Koşul                      |
| ---------------- | ---- | -------------------------- |
| Nakit akışı      | 30   | Gelir > Gider              |
| Borç/Gelir oranı | 25   | Aylık borç < Gelirin %40'ı |
| Tasarruf         | 20   | Birikim hedefi aktif       |
| Harcama kontrolü | 15   | Abonelik < Gelirin %5'i    |
| Gelir düzeni     | 10   | Düzenli gelir var          |

**Etiketler:** 0-40 Kritik · 41-60 Dikkat · 61-80 İyi · 81-100 Mükemmel

---

## Borç Sınıflandırma Sistemi

TCMB verisiyle desteklenen 3 kategori:

**🟢 STRATEJİK**
Konut kredisi + Faiz oranı < KFE (yıllık)

> "Eviniz yıllık %31.7 değerleniyor, kredinizin faizi %30 — değer yaratan borç"

**🟡 YÖNETİLEBİLİR**
Faiz oranı < TÜFE (yıllık)

> "Enflasyon borcunuzu eritiyor — ödeme planına devam et"

**🔴 KRİTİK**
Faiz oranı ≥ TÜFE

> "Faiz enflasyonun üzerinde — öncelikli öde"

---

## Borç Önceliklendirme Algoritması

Hibrit sistem — deterministik hesaplama + Gemini yorumu:

```
Öncelik Skoru =
  (Faiz puanı × 0.50) +
  (Sınıf puanı × 0.25) +
  (Borç/Gelir puanı × 0.15) +
  (Kalan süre puanı × 0.10)

Sınıf puanı: Kritik=100, Yönetilebilir=50, Stratejik=10
```

En yüksek skordan başlayarak Avalanche yöntemiyle öde.

---

## Özellikler

### 🔵 Veri Girişi

- PDF ekstresi okuma (Ziraat Bankası + Halkbank)
- Gemini File API ile otomatik format tespiti
- Streaming progress UI — her agent adımı canlı gösterilir

### 📊 Analiz

- Harcama kategorizasyonu (12 kategori)
- Nakit akışı görselleştirmesi
- Son 3 ay gider trendi (Line Chart)
- Önceki ayla karşılaştırma (5 metrik)
- Swipeable Pie/Column Chart

### 💳 Borç Yönetimi

- Borç haritası (Stratejik / Yönetilebilir / Kritik)
- Manuel faiz oranı girişi
- Gerçek fiyat etiketi — toplam faiz maliyeti
- Borç çıkış planı + ay-ay tablo
- TCMB veri kaynağı kutusu

### 🤖 Yapay Zeka Önerileri

- 3 öncelikli aksiyon kartı (Yüksek / Orta / Düşük)
- Karta tıklayınca detaylı açıklama + tahmini kazanım
- Abonelik puanlamasına göre kişiselleştirilmiş öneri

### 📱 Abonelik Puanlama

- Her aboneliği 1-5 yıldız ile değerlendir
- Düşük puanlı abonelikler için yıllık maliyet gösterimi
- AI önerilerine otomatik yansır

### 🎯 Birikim Hedefi

- İsim + tutar + fotoğraf + açıklama ile hedef oluştur
- Aylık birikim girişi
- Donut chart + tahmini tamamlanma tarihi
- Harcamalar sayfasında ayrı kategori

### 🔮 Senaryo Simülatörü

**Tab 1 — Borç Ödeme Hızlandırma:**

- Borç seç + ekstra ödeme tutarı (input + slider)
- Line chart: mevcut plan vs hızlandırılmış plan
- Erken bitiş tarihi + faiz tasarrufu + ay-ay tablo
- Gemini ile empatik yorum

**Tab 2 — Büyük Karar Simülasyonu:**

- 4 hazır şablon: "Arabamı satsam?" / "Maaşım artsa?" / "Borç kapatsam?" / "Abonelikleri iptal etsem?"
- Serbest metin girişi
- AI yanıtı: finansal etki + uyarı + 3 somut adım
- Şu an vs Yeni Senaryo karşılaştırma tablosu

### 💬 Sohbet Asistanı

- Kullanıcının kendi finansal verisine bakarak yanıtlar
- TCMB bağlamı ile zenginleştirilmiş
- Türkçe, empatik dil

### ✨ "Vay Be" Anı

- İlk PDF yüklemesinden sonra çarpıcı özet ekranı
- Framer Motion ile 5 aşamalı animasyon
- Dinamik gerçekler: "Paranın %39'u kredilere gitti"
- Animasyonlu finansal skor göstergesi
- Bir kez gösterilir, tekrar gösterilmez

### 🔐 Kimlik Doğrulama

- Firebase Auth — email/şifre
- Korumalı route'lar
- Kullanıcıya özel Firestore verileri

### 🎨 Arayüz

- Koyu yeşil tema (#356B59)
- Dark mode / Light mode toggle
- Glassmorphism kartlar
- Bento grid layout
- Framer Motion animasyonlar (sayfa geçişi, stagger, sayı sayma)
- Skeleton loading screens
- Fluid typography
- Tam responsive (mobile + tablet + desktop)

---

## Onboarding

4 soru ile kullanıcı profili oluşturulur:

1. **Gelir düzeni** — Sabit maaş / Değişken / İkisi de
2. **Şu anki tablo** — Ay sonu bitiyor / İdare ediyorum / Düzenli kalıyor
3. **Ana hedef** — Borçtan kurtulmak / Hedefe birikim / Harcamaları anlamak
4. **Harcama alışkanlığı** — Dürtüsel / Planlı ama kayıyor / Çok tutumlu

---

## Kullanıcı Akışı

```
Kayıt / Giriş (Firebase Auth)
        ↓
Onboarding (4 soru — para kişiliği)
        ↓
PDF yükle (Ziraat / Halkbank ekstresi)
        ↓
Pipeline çalışır (Streaming progress)
PDF Agent → Kategorizasyon → Zenginleştirme → Analiz → Öneri
        ↓
"Vay Be" anı (çarpıcı ilk özet)
        ↓
Dashboard açılır
        ↓
4 sayfa: Anasayfa · Harcamalar · Borç Haritası · Simülasyon · Asistan
        ↓
Aylık güncelleme: Yeni PDF → Karşılaştırmalı analiz
```

---

## Hedef Kullanıcı Senaryoları

---

### 👩 Zeynep, 24 — "Maaş nereye gidiyor?"

İlk işinde çalışıyor. Aylık 32.000₺ maaş alıyor ama her ay 25'inde cüzdanı boşalıyor. 2 kredi kartında 14.000₺ borç birikmiş. Asgari ödeme yapıyor çünkü "zaten az borç" diye düşünüyor.

**ParaPusula ne gösterir:**

- Harcamalarının %22'si yemek siparişine gidiyor
- Asgari ödemeyle devam ederse borç 4 yıl 8 ay sürer, 9.200₺ faiz öder
- Yemek siparişini kısıp ekstra ödeme yaparsa borç 14 ayda biter, 7.400₺ faiz tasarrufu

> _"Bu iki kartı sadece asgari ödemeyle kapatman 4 yıl 8 ay sürer. Bu sürede 9.200₺ sadece faiz ödersin."_

---

### 👨 Murat, 38 — "İdare ediyorum" sanıyor

Ankara'da eşi ve 2 çocuğuyla yaşıyor. 3 farklı bankada hesabı var ama toplamı hiç bir ekranda görmedi. Eşi "her ay biraz daha sıkışıyoruz" diyor.

**ParaPusula ne gösterir:**

- 3 bankanın ekstresi birleşince aylık 1.200₺ açık verdiği ortaya çıkıyor
- Konut kredisi → Stratejik (ev %34 değerleniyor, faiz %30)
- Esnaf kredisi → Kritik (iş kurulmadı, borç kaldı)
- "Arabamı satsam ne olur?" simülasyonu: 14 ay erken borç kapanır, 18.400₺ faiz tasarrufu

> _"Esnaf kredisini aldığından beri toplam 31.400₺ faiz ödedin."_

---

### 👩 Selin, 31 — Düzensiz gelir paniği

Grafik tasarımcı, serbest çalışıyor. Kimi ay 70.000₺, kimi ay 18.000₺. Mart ve Ekim'de vergi dönemi geliyor, her seferinde panikliyor.

**ParaPusula ne gösterir:**

- Şubat'ta 58.000₺ kazandı, 51.000₺ harcadı — "iyi ay" masalı çöküyor
- Her gelirden %20 vergi karşılığı ayrılıyor
- Sabit gider kalkanı: önce kira, sigorta, sabit giderler ayrılır
- Kötü ayda öncelik sırası: "Önce kirayı öde, yazılım aboneliklerini ertele"

> _"6 ay önce kötü ay gelince paniğe giriyordun. Şimdi 3 aylık tampon fonun var."_

---

### 👨 Kerem, 29 — Parası var ama çalışmıyor

Yazılım şirketinde kıdemli geliştirici. Aylık 85.000₺ maaş, ay sonunda para kalıyor ama kaybolup gidiyor. Hedef: 18 ayda araba almak.

**ParaPusula ne gösterir:**

- Son 6 ayda 118.000₺ fazla verdi, 95.000₺'si fark etmeden harcandı
- Araba hedefi somutlaşıyor: aylık 10.800₺ ayırırsa 18 ayda 195.000₺
- Simülatör: "16.000₺ ayırırsam 12 ayda olur ama her ay 2.000₺ sıkışık yaşarım"
- 23.000₺ vadesiz hesapta duruyor — enflasyona yenik düşüyor

> _"Bu hızla → Araba hedefine Aralık 2027'de ulaşırsın."_

---

## Değerlendirme Kriterleri Karşılığı

| Kriter                | Puan | ParaPusula'nın Karşılığı                        |
| --------------------- | ---- | ----------------------------------------------- |
| Kullanıcı Değeri      | 20   | 4 gerçek kullanıcı profili, Türkiye'ye özel     |
| Teknik Puan           | 20   | LangGraph + Gemini + TCMB + RAG                 |
| Performans & Doğruluk | 10   | Deterministik algoritma + TCMB canlı veri       |
| Agentic Yapılar       | 10   | 6 ajan, LangGraph DAG, koşullu dallanma         |
| Yenilikçilik          | 10   | Abonelik puanlama + stratejik borç analizi      |
| Kullanıcı Dostu       | 10   | 4 sorulu onboarding, streaming UI, "Vay Be" anı |

---

_ParaPusula — BTK Akademi Hackathon 2026_
_Tüm hakları saklıdır._
