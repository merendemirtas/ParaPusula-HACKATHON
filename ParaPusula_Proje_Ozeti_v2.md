# ParaPusula — Kapsamlı Proje Özeti v2

> Yapay Zeka Destekli Kişisel Finansal Özgürlük Asistanı
> BTK Akademi Hackathon 2026

---

## 1. Misyon ve Problem Tanımı

### Misyon

Türkiye'de yaşayan bireyleri borç tuzağından çıkarmak, harcamalarını anlamalarını sağlamak ve finansal hedeflerine ulaştırmak için hem ayna tutan hem kişiselleştirilmiş yol haritası sunan bir yapay zeka uygulaması. Türkiye'ye özel, Türkçe, empatik.

### Problem

Türkiye'de milyonlarca insan hayat kalitesini artırmak için borçlanıyor; ancak her borç döngüsü stres seviyesini yükseltiyor ve finansal özgürlüğü daha da uzaklaştırıyor. Bu borç tuzağından çıkmanın önündeki en büyük engel bilgi eksikliği değil — **netlik eksikliğidir.**

**Borç tuzağı döngüsü:**
Hayat pahalılaşır → Kredi / borç alınır → Faiz ödenir → Daha çok çalışılması gerekir → Hayat kalitesi düşer → Tekrar borç alınır → Döngü başlar

### Piyasadaki Boşluk

Mevcut uygulamalar (Cleo, YNAB, Finart vb.) ya ABD odaklı ve Türk bankalarıyla uyumsuz, ya da sadece harcama takibi yapan yüzeysel araçlar. **Hiçbiri borç tuzağını gösterip çıkış planı üretmiyor, hiçbiri Türkiye ekonomik gerçekleriyle konuşmuyor.**

---

## 2. Hedef Kitle

- Borç / kredi yükü taşıyan 18 yaş üzeri bireyler
- Ekonomik baskı altında yaşayan orta ve alt gelir grubu
- Yatırım bilgisi veya finansal okuryazarlığı olmayan kullanıcılar
- Düzensiz gelirle çalışan serbest çalışanlar
- Finansal hedefi olan (araba, ev, tatil) ama nasıl biriktireceklerini bilmeyenler

---

## 3. Rakip Analizi

| Özellik                 | Cleo / YNAB | Finart      | ParaPusula              |
| ----------------------- | ----------- | ----------- | ----------------------- |
| Türkiye bankası desteği | Hayır       | Hayır       | Evet (PDF ekstresi)     |
| Türkçe dil desteği      | Hayır       | Kısmi       | Evet, tam destek        |
| Borç tuzağını gösterme  | Hayır       | Hayır       | Evet — özümüz bu        |
| Empati dili             | Roast modu  | Yok         | Anlayan, destekleyen    |
| Senaryo simülatörü      | Sınırlı     | Yok         | Tam kapsamlı            |
| Türkiye'ye özel içerik  | Hayır       | Hayır       | TÜFE, TL, TCMB verisi   |
| Çıkış odaklı plan       | Genel bütçe | Genel bütçe | Borç tuzağından çıkış   |
| Abonelik puanlama       | Yok         | Yok         | Evet — orijinal özellik |
| Güncel konut endeksi    | Yok         | Yok         | TCMB EVDS API           |
| Agentic yapı            | Yok         | Yok         | LangGraph multi-agent   |

---

## 4. Değerlendirme Kriterleri ve ParaPusula'nın Karşılığı

### 🏆 20 PUAN — Kullanıcı Değeri

**"Ürün gerçekten uygulanabilir mi ve tüketicilerin problemlerini çözer mi?"**

ParaPusula dört farklı gerçek kullanıcı profilini çözer:

**Zeynep (24, yeni mezun):** 32.000₺ maaş, ay sonu para bitiyor, 14.000₺ kredi kartı borcu. Uygulama ilk PDF yüklemesinde paranın nereye gittiğini gösterir, asgari ödemeyle 4 yıl 8 ay süreceğini hesaplar, Avalanche yöntemiyle 14 aylık çıkış planı üretir.

**Murat (38, orta gelir):** 3 farklı bankada 412.000₺ borç, "idare ediyorum" sanıyor ama her ay 1.200₺ açık veriyor. Uygulama 3 bankanın ekstresini birleştirip tek tablo oluşturur, konut kredisini TCMB verisiyle "stratejik borç" olarak gösterir, esnaf kredisini "kötü borç" olarak sınıflandırır.

**Selin (31, serbest çalışan):** Kimi ay 70.000₺ kimi ay 18.000₺ kazanıyor. Her vergi döneminde panikliyor. Uygulama değişken gelir modunda çalışır, her ay gelirin %20'sini vergi karşılığı olarak otomatik ayırır.

**Kerem (29, yüksek gelirli):** Borcu yok ama para "çalışmıyor." 18 ayda araba almak istiyor. Uygulama hedefi aylık rakama dönüştürür, ilerlemeyi görselleştirir.

**Sonuç:** Türkiye'de milyonlarca insanın gerçek problemini çözüyor, banka API lisansı gerekmeden çalışıyor, tamamen ücretsiz kullanılabiliyor.

---

### 🏆 20 PUAN — Teknik Puan

**"Projede doğru algoritmalar, mimari yaklaşımlar ve araçlar kullanılmış mı?"**

**Mimari: Multi-Agent Pipeline (LangGraph + A2A)**

```
Kullanıcı PDF yükler
        ↓
[PDF Agent] — Gemini File API ile ekstreleri okur, işlemleri çıkarır
        ↓
[Kategorizasyon Agent] — Harcamaları kategorize eder, abonelikleri tespit eder
        ↓
[Veri Zenginleştirme Agent] — TCMB EVDS API'den KFE, TÜFE, faiz verisi çeker
        ↓
[Analiz Agent] — Nakit akışı, borç haritası, finansal sağlık skoru hesaplar
        ↓
[Öneri Agent] — Kişiselleştirilmiş 3 aksiyon, borç çıkış planı üretir
        ↓
[Sohbet Agent] — Kullanıcı sorularını kullanıcının kendi verisine bakarak yanıtlar
```

Ajanlar arası iletişim **A2A (Agent-to-Agent Protocol)** ile yönetilir. Her ajan bağımsız çalışır, görev devri standart protokolle gerçekleşir.

**RAG (Retrieval-Augmented Generation)**
Her AI çağrısına Türkiye'ye özel bağlam eklenir:

- TCMB EVDS API'den çekilen güncel KFE (Konut Fiyat Endeksi)
- Güncel TÜFE ve enflasyon verileri
- BDDK azami kredi faiz oranları
- Asgari ücret

Bu sayede AI "Türkiye gerçeklerini bilerek" konuşur — global rakiplerin yapamadığı şey.

**Kullanılan Teknolojiler:**

| Katman             | Teknoloji                     | Gerekçe                                |
| ------------------ | ----------------------------- | -------------------------------------- |
| AI motoru          | Gemini API (Gemini 2.0 Flash) | Zorunlu + ana beyin                    |
| PDF okuma          | Gemini File API               | Parser yazmaya gerek kalmıyor          |
| Agent orkestrasyon | LangGraph + LangChain         | Multi-agent pipeline yönetimi          |
| Agent iletişim     | A2A Protocol                  | Standart agent haberleşmesi            |
| Backend            | FastAPI (Python)              | Hızlı, modern, async destek            |
| Veritabanı         | Firebase (Firestore)          | Google ekosistemi uyumu, ücretsiz tier |
| Frontend           | React + Recharts              | Arayüz + veri görselleştirme           |
| Dış veri           | TCMB EVDS API                 | KFE, TÜFE, faiz — resmi ve ücretsiz    |

---

### 🏆 10 PUAN — Performans ve Doğruluk

**"Üretken yapay zeka çıktıları doğru, alakalı ve verimli mi?"**

**Doğruluk için alınan önlemler:**

**Gerçek veriye dayalı hesaplamalar:** AI tahmin değil, kullanıcının kendi PDF verisinden çıkarılan rakamları kullanır. "14.000₺ borcun var" değil, "ekstrendeki X banka Y tarihli işlemden gelen 14.000₺ borcun var" der.

**TCMB verisiyle desteklenmiş analizler:** Konut fiyat değerlendirmesi, enflasyon karşılaştırması ve faiz analizi resmi TCMB verisiyle yapılır. AI'ın kendi bilgisine güvenilmez, API'den çekilen güncel veri kullanılır.

**Yapılandırılmış çıktı (Structured Output):** Her ajan JSON formatında çıktı üretir, bir sonraki ajan bu yapılandırılmış veriyi alır. Serbest metin yerine şema tabanlı veri akışı — tutarsızlık riski minimuma indirilir.

**Çıktı doğrulama katmanı:** Her ajanın çıktısı bir sonrakine geçmeden önce doğrulanır. Eksik veya tutarsız veri tespit edilirse kullanıcıya bildirim gönderilir.

**Verimlilik:** Gemini 2.0 Flash modeli tercih edilir — yüksek doğruluk, düşük gecikme, ücretsiz tier limitlerinde kalınır.

---

### 🏆 10 PUAN — Agentic Yapılar

**"Üretken yapay zeka içinde agentic yapılar var mı? Doğru uygulamalar yapılmış mı?"**

ParaPusula'nın agentic mimarisi birbirinden bağımsız 6 ajandan oluşur:

**PDF Agent**

- Görev: Gemini File API ile banka ekstresini okur
- Girdi: Ham PDF dosyası
- Çıktı: Yapılandırılmış işlem listesi (tarih, tutar, açıklama, banka)
- Özellik: Birden fazla banka ekstresini birleştirir

**Kategorizasyon Agent**

- Görev: İşlemleri kategorize eder
- Girdi: Yapılandırılmış işlem listesi
- Çıktı: Kategorili harcama tablosu (market, yemek, abonelik, kredi, vb.)
- Özellik: Abonelikleri otomatik tespit eder

**Veri Zenginleştirme Agent**

- Görev: TCMB EVDS API'den güncel ekonomik veri çeker
- Girdi: Kullanıcının borç türleri
- Çıktı: KFE, TÜFE, faiz oranları — bu ajanın çıktısı analiz ajanına bağlam sağlar
- Özellik: Konut kredisi varsa KFE otomatik çekilir

**Analiz Agent**

- Görev: Nakit akışı, borç haritası, skor hesaplar
- Girdi: Kategorili harcamalar + TCMB verisi + geçmiş aylar
- Çıktı: Finansal sağlık skoru, borç sınıflandırması, nakit akışı özeti
- Özellik: Aylık karşılaştırmalı analiz

**Öneri Agent**

- Görev: Kişiselleştirilmiş plan ve aksiyonlar üretir
- Girdi: Analiz çıktısı + onboarding profili
- Çıktı: 3 somut aksiyon, borç çıkış planı, senaryo simülasyonu
- Özellik: Para kişiliğine göre dil ve strateji değişir

**Sohbet Agent**

- Görev: Kullanıcı sorularını kullanıcının kendi verisine bakarak yanıtlar
- Girdi: Kullanıcı sorusu + tüm finansal snapshot
- Çıktı: Empatik, kişiselleştirilmiş Türkçe yanıt
- Özellik: "Arabamı satsam mı?" gibi açık uçlu soruları kendi verisiyle yorumlar

**A2A ile ajan koordinasyonu:** Ajanlar birbirinden bağımsız çalışır. Bir ajan görevi bitirince A2A protokolüyle bir sonrakine devreder. Bu sayede her ajan sadece kendi sorumluluğuna odaklanır, sistemin bir parçası bozulsa diğerleri çalışmaya devam eder.

---

### 🏆 10 PUAN — Yenilikçilik ve Özgünlük

**"Yenilikçi bir fikir mi?"**

ParaPusula'yı özgün kılan 5 unsur:

**1. Abonelik Puanlama Sistemi**
Kullanıcı her aboneliği 1-5 üzerinden kullanım puanıyla değerlendirir. Hiçbir uygulamada bu yok. AI bu puanı kullanarak gerçek maliyet gösterir:

> "Netflix'e 219₺/ay, yılda 2.628₺ ödüyorsun — kullanım puanın 1/5."

**2. TCMB Verisiyle Stratejik Borç Analizi**
Konut kredisini "kötü borç / stratejik borç" diye ayırmak için resmi Konut Fiyat Endeksi kullanılıyor. Dünyada bu analizi yapan bireysel finans uygulaması yok.

> "Eviniz son 12 ayda %34 değer kazandı, kredinizin aylık faizi %1.82 — bu stratejik bir borç."

**3. Değişken Gelir Modu**
Serbest çalışanlar için ayrı bir hesaplama mantığı: her ay gelen gelirden önce sabit giderler ve vergi karşılığı ayrılır, "gerçekten kullanılabilir para" ayrıca gösterilir.

**4. Banka API'si Olmadan Türk Bankalarını Destekleme**
Plaid veya Open Banking API gerektirmez. PDF ekstresi yeterli — bu Türkiye'deki en büyük engeli ortadan kaldırıyor.

**5. Gelecek Odaklı Senaryo Simülatörü**
"Bunu yapsaydım ne olurdu?" değil, "bunu yaparsam ne olur?" sorusunu yanıtlıyor. Geçmişi değil geleceği simüle ediyor.

---

### 🏆 10 PUAN — Kullanıcı Dostu Çalışma

**"Kullanıcıların rahatlıkla anlayabileceği, kullanabileceği bir ürün mü?"**

**Katmanlı Sadelik Prensibi**
Uygulama kasıtlı olarak 4 sayfadan oluşur. Karmaşıklık görünmez — derine indikçe güç orada bekler.

**Ana sayfa:** Sadece finansal sağlık skoru, bu ay nakit durumu ve 3 somut aksiyon. Başka hiçbir şey yok.

**Borç haritası:** Tüm borçlar, faiz maliyetleri, çıkış planı. Krediye tıklandığında kalan ay, faiz oranı, toplam faiz maliyeti açılır.

**Harcamalar:** Grafik + liste birlikte sunulur. Kategoriye tıklandığında o kategorinin işlemleri açılır. Abonelikler kategorisinde puanlama yapılabilir.

**Asistan:** Sohbet arayüzü. Kullanıcı kendi verisine bakarak soru sorar.

**"Vay Be" Anı Tasarımı**
İlk PDF yüklemesinden sonra kullanıcı "bunu hiç bilmiyordum" hissini yaşamalı. Bu an ne kadar çarpıcı olursa kullanıcı o kadar bağlanır. Tüm UX bu ana göre tasarlanmıştır.

**Empati Dili**
Rakipler kullanıcıyı azarlar (Cleo'nun roast modu). ParaPusula anlar, destekler. Rakamlar acımasız olabilir ama dil her zaman empatik kalır.

**Sürtünmesiz Güncelleme**
Kullanıcı sadece yeni PDF yükler, sistem geri kalanı halleder. Değişmeyen veriler korunur, sadece değişenler güncellenir.

**Onboarding: 4 Soru, Tam Kişiselleştirme**

Soru 1 — Gelir düzeni: Sabit maaş / Değişken / İkisi de
Soru 2 — Şu anki tablo: Ay sonu bitiyor / İdare ediyorum / Düzenli kalıyor
Soru 3 — Ana hedef: Borçtan kurtulmak / Hedefe birikim / Harcamaları anlamak
Soru 4 — Harcama alışkanlığı: Dürtüsel / Planlı ama kayıyor / Çok tutumlu

Bu 4 sorunun kombinasyonu uygulamanın hangi özellikleri öne çıkaracağını, AI'ın nasıl bir dil kullanacağını ve ilk aksiyonların içeriğini belirler.

---

## 5. Teknik Altyapı — Detaylı

### AI Motoru

**Gemini 2.0 Flash** — hız ve doğruluk dengesi, ücretsiz tier günde 1.500 istek.

### Agent Mimarisi

**LangGraph** ile yönlü asiklik graf (DAG) üzerinde ajan akışı yönetilir. Her ajan bir node, her geçiş bir edge. Koşullu dallanma desteklenir — örneğin kullanıcının konut kredisi yoksa Veri Zenginleştirme Ajanı KFE çekmez, zamanı ve API kotasını boşa harcamaz.

**A2A Protocol** ile ajanlar arası mesaj formatı standartlaştırılmıştır. Her ajan gelen görevi parse eder, işler, bir sonrakine iletir.

### Veri Mimarisi (Firebase Firestore)

```
users/{userId}
  ├── profile (onboarding cevapları, para kişiliği)
  ├── snapshots/{ay}
  │     ├── gelir
  │     ├── gider_kategoriler
  │     ├── borc_listesi
  │     ├── finansal_skor
  │     └── ai_oneriler
  └── goals/{hedefId}
        ├── hedef_tutar
        ├── baslangic_tarihi
        └── aylik_birikim
```

Veriler üzerine yazılmaz — her ay yeni snapshot eklenir. Bu yapı hem ilerleme grafiğini hem de AI'ın karşılaştırmalı analizini besler.

### TCMB EVDS API Entegrasyonu

- Endpoint: evds2.tcmb.gov.tr
- Ücretsiz API key ile erişim
- Çekilen veriler: KFE (Konut Fiyat Endeksi), YKKE (Yeni Kiracı Kira Endeksi), TÜFE, kredi faiz oranları
- Cache mekanizması: Veriler günlük çekilir, Firestore'da saklanır — her kullanıcı isteğinde API çağrısı yapılmaz

### RAG Mimarisi

Her Gemini API çağrısına sistem prompt olarak şu bağlam eklenir:

```
Türkiye ekonomik bağlamı (güncel):
- TÜFE: %{tüfe}
- Konut Fiyat Endeksi yıllık değişim: %{kfe}
- Azami tüketici kredisi faizi: %{faiz}
- Asgari ücret: {asgari_ucret}₺

Kullanıcı profili:
- Para kişiliği: {kisilik}
- Ana hedef: {hedef}
- Gelir düzeni: {gelir_duzeni}
```

Bu bağlamla AI her zaman Türkiye gerçeklerini bilerek, kullanıcıya özel konuşur.

---

## 6. Kullanıcı Akışı

```
Uygulama açılır
      ↓
Kayıt / Giriş (Firebase Auth)
      ↓
Onboarding — 4 soru (para kişiliği + hedef belirlenir)
      ↓
Veri girişi — PDF yükle veya manuel gir
      ↓
      ├── PDF yükle → Gemini File API okur → PDF Agent işler
      └── Manuel gir → Form ekranı
      ↓
Multi-agent pipeline çalışır (arka planda)
PDF Agent → Kategorizasyon → Veri Zenginleştirme → Analiz → Öneri
      ↓
Ana sayfa açılır:
Finansal sağlık skoru + nakit durumu + 3 aksiyon
      ↓
4 sayfa:
Ana sayfa / Borç haritası / Harcamalar / Asistan
      ↓
Aylık güncelleme döngüsü:
Ay sonu bildirim → Yeni PDF → Karşılaştırmalı analiz → Güncellenen plan
```

---

## 7. Özellikler — Tam Liste

1. **PDF ekstresi okuma** — Gemini File API, çoklu banka desteği
2. **Harcama kategorizasyonu** — grafik + liste, kategoriye tıklayınca detay
3. **Abonelik puanlama** (1-5) — yıllık maliyet gösterimi, isteğe bağlı
4. **Nakit akışı görselleştirmesi** — aylık gelir-gider dengesi
5. **Borç haritası** — krediye tıklayınca kalan ay + faiz oranı + toplam maliyet
6. **Borç sınıflandırması** — stratejik / gri bölge / kötü borç (TCMB verisiyle)
7. **Borç çıkış planı** — Avalanche veya Snowball, aylık ödeme sırası
8. **Finansal sağlık skoru** (0-100) — her ay güncellenir
9. **Senaryo simülatörü** — gelecek odaklı, iki senaryoyu karşılaştırır
10. **Gerçek fiyat etiketi** — taksitli alımın toplam maliyeti
11. **Para kişiliği analizi** — onboarding'den çıkarılır, tüm dili etkiler
12. **"Bu ay ne yapmalıyım?"** — 3 somut aksiyon, AI üretir
13. **Hedef birikim takibi** — aylık ilerleme görselleştirmesi
14. **Aylık özet raporu** — geçen ayla karşılaştırma
15. **Yapay zeka sohbet asistanı** — kullanıcının kendi verisine bakarak Türkçe yanıt
16. **Aylık güncelleme döngüsü** — yeni PDF + karşılaştırmalı analiz

---

## 8. Teknoloji Yığını — Kesinleşmiş

| Katman             | Teknoloji                     |
| ------------------ | ----------------------------- |
| AI motoru          | Gemini API (Gemini 2.0 Flash) |
| PDF okuma          | Gemini File API               |
| Agent orkestrasyon | LangGraph + LangChain         |
| Agent iletişim     | A2A Protocol                  |
| Backend            | FastAPI (Python)              |
| Veritabanı         | Firebase (Firestore + Auth)   |
| Frontend           | React + Recharts              |
| Dış veri           | TCMB EVDS API                 |

---

## 9. Gelecek Yol Haritası (MVP Sonrası)

- Mobil uygulama (iOS / Android)
- Daha fazla banka PDF formatı desteği
- Gemini Function Calling entegrasyonu
- Açık bankacılık entegrasyonu (yasal altyapı oturduğunda)

---

_ParaPusula Proje Özeti v2 — BTK Akademi Hackathon 2026_
_Tüm hakları saklıdır._
