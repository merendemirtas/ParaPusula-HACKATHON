"""
ParaPusula - TCMB EVDS Veri Servisi
evds Python kütüphanesi ile TCMB verisi çeker.

Seriler:
  TP.FG.J0   → TÜFE endeks seviyesi (12-aylık değişim hesaplanır)
  TP.KTF10   → Azami tüketici kredi faizi (yıllık %, /12 → aylık)
  TP.HKFE02  → KFE (seri mevcut değil, fallback kullanılır)

Cache: Firestore tcmb_cache/latest, 24 saatlik TTL.
"""

import os
import asyncio
from datetime import datetime, timedelta, date
from typing import Optional

from dotenv import load_dotenv
from evds import evdsAPI

from models.schemas import TCMBData

load_dotenv()

# ─── Fallback (API erişilemez veya seri boşsa) ────────────
FALLBACK_TCMB: dict = {
    "tufe":         30.6,    # TÜFE 12-aylık değişim (2026 başı tahmini)
    "kfe":          34.0,    # KFE yıllık değişim (seri mevcut değil)
    "azami_faiz":   5.1,     # Aylık azami kredi faizi (≈ 61% yıllık / 12)
    "asgari_ucret": 22104.0, # 2025 brüt asgari ücret (TL)
}


def _evds_api() -> evdsAPI:
    """API key ile evds istemcisi döndürür."""
    return evdsAPI(os.getenv("TCMB_API_KEY", ""))


def _son_tarih_aralik(ay_geri: int = 14) -> tuple[str, str]:
    """
    Yeterli geçmiş içeren DD-MM-YYYY tarih aralığı.
    TÜFE 12-aylık değişim için en az 13 ay geriye gitmeli.
    """
    bitis = date.today()
    d = date(bitis.year, bitis.month, 1)
    for _ in range(ay_geri):
        d = date(d.year - (1 if d.month == 1 else 0), d.month - 1 or 12, 1)
    return d.strftime("%d-%m-%Y"), bitis.strftime("%d-%m-%Y")


def _tufe_hesapla(df) -> Optional[tuple[float, str]]:
    """
    TP.FG.J0 endeks DataFrame'inden 12-aylık yüzde değişim hesaplar.
    Döner: (degisim_yuzde, son_veri_tarihi) veya None.
    """
    try:
        col = "TP_FG_J0"
        if col not in df.columns:
            return None
        temiz = df[[col]].dropna()
        if len(temiz) < 13:
            return None
        son      = float(temiz[col].iloc[-1])
        once     = float(temiz[col].iloc[-13])
        degisim  = round((son / once - 1) * 100, 2)
        # Tarih: evds "Tarih" sütunu "YYYY-M" formatında (leading zero yok)
        # Örn: "2026-1" → "Ocak 2026"
        AYLAR = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"]
        try:
            ham = str(df.loc[temiz.index[-1], "Tarih"] if "Tarih" in df.columns
                      else temiz.index[-1])
            parcalar = ham.split("-")
            yil, ay_no = int(parcalar[0]), int(parcalar[1])
            tarih_str = f"{AYLAR[ay_no - 1]} {yil}"
        except Exception:
            tarih_str = "?"
        return degisim, tarih_str
    except Exception:
        return None


def _azami_faiz_hesapla(df) -> Optional[float]:
    """
    TP.KTF10 DataFrame'inden son geçerli yıllık faizi alır, aylığa çevirir.
    """
    try:
        col = "TP_KTF10"
        if col not in df.columns:
            return None
        temiz = df[col].dropna()
        if temiz.empty:
            return None
        yillik = float(temiz.iloc[-1])
        return round(yillik / 12, 4)  # aylık %
    except Exception:
        return None


class TCMBService:
    """evds kütüphanesiyle TCMB verisi çeken servis."""

    # ── Gerçek API çağrısı (sync — asyncio.to_thread ile sarılır) ──
    def _veri_cek_sync(self) -> dict:
        """
        evdsAPI.get_data() sync çağrısı.
        Dönen dict: {tufe, kfe, azami_faiz, asgari_ucret} veya hata bilgisi.
        """
        api = _evds_api()
        baslangic, bitis = _son_tarih_aralik()

        sonuclar: dict = {}
        log: list[str] = []

        # ── TÜFE (TP.FG.J0) — 16 ay geri (12-aylık karşılaştırma için) ──
        try:
            bas16, _ = _son_tarih_aralik(16)
            log.append(f"TP.FG.J0  (TÜFE)  : sorgu {bas16} → {bitis}")
            df_tufe = api.get_data(["TP.FG.J0"], startdate=bas16, enddate=bitis)
            sonuc = _tufe_hesapla(df_tufe)
            if sonuc is not None:
                tufe, veri_tarihi = sonuc
                sonuclar["tufe"] = tufe
                log.append(f"TP.FG.J0  (TÜFE)  : %{tufe:.2f} 12-aylık değişim ✓")
                print(f"[TCMB] TÜFE verisi: %{tufe:.2f} — tarih: {veri_tarihi}")
            else:
                log.append(f"TP.FG.J0  (TÜFE)  : hesaplanamadı → fallback %{FALLBACK_TCMB['tufe']}")
                print(f"[TCMB] TÜFE verisi: hesaplanamadı (satır sayısı yetersiz veya sütun yok)")
        except Exception as e:
            log.append(f"TP.FG.J0  HATA: {e}")
            print(f"[TCMB] TÜFE HATA: {e}")

        # ── Azami Faiz (TP.KTF10) — son 6 ay (dinamik, hardcoded tarih yok) ──
        try:
            bas_faiz, _ = _son_tarih_aralik(6)
            df_faiz = api.get_data(["TP.KTF10"], startdate=bas_faiz, enddate=bitis)
            azami = _azami_faiz_hesapla(df_faiz)
            if azami is not None:
                sonuclar["azami_faiz"] = azami
                log.append(f"TP.KTF10  (Faiz)  : %{azami:.4f}/ay ({azami*12:.2f}% yıllık) ✓")
            else:
                log.append(f"TP.KTF10  (Faiz)  : boş → fallback %{FALLBACK_TCMB['azami_faiz']}/ay")
        except Exception as e:
            log.append(f"TP.KTF10  HATA: {e}")

        # ── KFE: TP.HKFE01 → TP.FE.OKTG03 → fallback ────
        # KARAR: KFE serisi için 28 ay geri git — 12-aylık karşılaştırma için
        # en az 13 aylık veri gerekiyor ve TP.FE.OKTG03 Mayıs 2025'ten itibaren var.
        bas_kfe, _ = _son_tarih_aralik(28)
        # KARAR: TP.HKFE01 endeks seviyesi döndürüyor (gerçekdışı %1000+ çıkıyor).
        # Sadece TP.FE.OKTG03 kullanılıyor; geçerli aralık 5-200% arası kabul edilir.
        kfe_val = None
        try:
            df_kfe = api.get_data(["TP.FE.OKTG03"], startdate=bas_kfe, enddate=bitis)
            col_kfe = "TP_FE_OKTG03"
            if df_kfe is not None and not df_kfe.empty and col_kfe in df_kfe.columns:
                temiz_kfe = df_kfe[col_kfe].dropna()
                if len(temiz_kfe) >= 13:
                    degisim = round(
                        (float(temiz_kfe.iloc[-1]) / float(temiz_kfe.iloc[-13]) - 1) * 100, 2
                    )
                    if 5 <= degisim <= 200:   # Makul aralık kontrolü
                        kfe_val = degisim
                        log.append(f"TP.FE.OKTG03 (KFE): %{kfe_val} 12-aylık değişim ✓")
                    else:
                        log.append(f"TP.FE.OKTG03 (KFE): %{degisim} gerçekdışı değer → fallback %{FALLBACK_TCMB['kfe']}")
                else:
                    log.append(f"TP.FE.OKTG03 (KFE): yeterli satır yok ({len(temiz_kfe)}) → fallback %{FALLBACK_TCMB['kfe']}")
            else:
                log.append(f"TP.FE.OKTG03 (KFE): boş DataFrame → fallback %{FALLBACK_TCMB['kfe']}")
        except Exception as e:
            log.append(f"TP.FE.OKTG03 (KFE): HATA {e} → fallback %{FALLBACK_TCMB['kfe']}")

        if kfe_val is not None:
            sonuclar["kfe"] = kfe_val
        else:
            log.append(f"KFE: tüm seriler başarısız → fallback %{FALLBACK_TCMB['kfe']} kullanılıyor")

        return {"sonuclar": sonuclar, "log": log}

    async def _api_den_cek(self) -> TCMBData:
        """evds çağrısını thread'e taşır, sonuçları birleştirir."""
        key = os.getenv("TCMB_API_KEY", "")
        print(f"\n[TCMB] evds API başlıyor (key ilk 5: {key[:5]}...)")

        sonuc_dict = await asyncio.to_thread(self._veri_cek_sync)
        sonuclar = sonuc_dict["sonuclar"]

        print("[TCMB] ─── Seri Sonuçları ───────────────────────────")
        for satir in sonuc_dict["log"]:
            print(f"[TCMB]   {satir}")
        print("[TCMB] ─────────────────────────────────────────────\n")

        return TCMBData(
            tufe=sonuclar.get("tufe", FALLBACK_TCMB["tufe"]),
            kfe=sonuclar.get("kfe", FALLBACK_TCMB["kfe"]),
            azami_faiz=sonuclar.get("azami_faiz", FALLBACK_TCMB["azami_faiz"]),
            asgari_ucret=FALLBACK_TCMB["asgari_ucret"],
            guncelleme_tarihi=datetime.now().isoformat(),
        )

    # ── Cache'li getter ────────────────────────────────────
    async def tcmb_verisi_getir(self, firebase_service) -> TCMBData:
        """24 saatlik cache; eski veya yoksa API'ye git."""
        try:
            cache = await firebase_service.tcmb_cache_oku()
            if cache:
                gecen = datetime.now() - datetime.fromisoformat(cache.guncelleme_tarihi)
                if gecen < timedelta(hours=24):
                    print(f"[TCMB] Cache taze ({int(gecen.total_seconds()/3600)}s önce), API atlandı.")
                    return cache

            taze = await self._api_den_cek()
            try:
                await firebase_service.tcmb_cache_yaz(taze)
                print("[TCMB] Firestore cache güncellendi ✓")
            except Exception as e:
                print(f"[TCMB] Cache yazma uyarısı: {e}")
            return taze

        except Exception as e:
            print(f"[TCMB] Genel hata, fallback: {e}")
            return TCMBData(**FALLBACK_TCMB, guncelleme_tarihi=datetime.now().isoformat())

    # ── Cache'i atlayan zorla yenileme ────────────────────
    async def taze_veri_zorla(self, firebase_service) -> TCMBData:
        """/tcmb/refresh: cache atlanır, API'ye gidilir."""
        taze = await self._api_den_cek()
        try:
            await firebase_service.tcmb_cache_yaz(taze)
        except Exception as e:
            print(f"[TCMB] Cache yazma hatası: {e}")
        return taze


tcmb_service = TCMBService()


# ── Startup bağlantı testi ────────────────────────────────
async def test_tcmb_connection():
    """Backend başlarken evds bağlantısını test eder."""
    key = os.getenv("TCMB_API_KEY", "")
    print("\n" + "─" * 52)
    print("  TCMB EVDS BAĞLANTI TESTİ (evds kütüphanesi)")
    print("─" * 52)
    print(f"  TCMB Key (ilk 5 kar): {key[:5]}...")

    def _test_sync():
        api = _evds_api()
        # Hızlı test: son 2 ay KTF10
        baslangic = (date.today().replace(day=1)).__str__()[:7]
        df = api.get_data(["TP.KTF10"], startdate="01-04-2026", enddate="01-05-2026")
        return df

    try:
        df = await asyncio.to_thread(_test_sync)
        if df is not None and not df.empty and "TP_KTF10" in df.columns:
            azami_yillik = float(df["TP_KTF10"].dropna().iloc[-1])
            print(f"  TP.KTF10 (son)      : %{azami_yillik:.2f} yıllık → %{azami_yillik/12:.4f} aylık")
            print("  Bağlantı durumu     : ✓ BAŞARILI — evds API çalışıyor")
        else:
            print("  Bağlantı durumu     : ✗ Veri alınamadı (fallback kullanılacak)")
    except Exception as e:
        print(f"  Bağlantı durumu     : ✗ HATA — {e}")

    print("─" * 52 + "\n")
