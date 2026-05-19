"""
ParaPusula - Ana FastAPI Uygulaması
Tüm router'ları bağlar, CORS ayarlarını yapar ve sunucuyu başlatır.
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Ortam değişkenlerini yükle
load_dotenv()

# Router'ları import et
from routers import upload, analysis, chat, tcmb, onboarding, goals, simulator
from services.tcmb_service import test_tcmb_connection

# Geçici dosya dizini
TEMP_DIR = os.path.join(os.path.dirname(__file__), "temp")

# ─────────────────────────────────────────────
# Uygulama Yaşam Döngüsü
# ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(_app: FastAPI):
    """
    Uygulama başlangıç ve kapanış işlemleri.
    startup: temp/ dizinini oluştur, Firebase bağlantısını test et
    shutdown: Temizlik işlemleri
    """
    # ── Startup ─────────────────────────────
    print("\n" + "="*50)
    print("  ParaPusula API Başlatılıyor...")
    print("="*50)

    # Temp dizinini oluştur
    os.makedirs(TEMP_DIR, exist_ok=True)
    print(f"  Temp dizini hazır: {TEMP_DIR}")

    # Firebase bağlantısını test et
    try:
        from services.firebase_service import firebase_service
        # Basit bir okuma denemesi ile bağlantıyı doğrula
        await firebase_service.tcmb_cache_oku()
        print("  Firebase Firestore bağlantısı: BASARILI")
    except Exception as e:
        print(f"  Firebase Firestore uyarisi: {e}")
        print("  (Firebase olmadan devam ediliyor - gelistirme modu)")

    # Gemini API bağlantısını test et
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    if gemini_key:
        print(f"  Gemini API Key: {gemini_key[:5]}...{gemini_key[-4:]}")
    else:
        print("  UYARI: GEMINI_API_KEY tanimlanmamis!")

    # TCMB API bağlantısını test et
    await test_tcmb_connection()

    print("="*50)
    print("  ParaPusula API hazir!")
    print("="*50 + "\n")

    yield

    # ── Shutdown ────────────────────────────
    print("\n[ParaPusula] API kapatiliyor...")


# ─────────────────────────────────────────────
# FastAPI Uygulaması
# ─────────────────────────────────────────────

app = FastAPI(
    title="ParaPusula API",
    description=(
        "Kişisel finans analiz platformu. "
        "Banka ekstresini yükle, AI destekli analiz al, "
        "borç haritanı oluştur ve finansal hedeflerine ulaş."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)


# ─────────────────────────────────────────────
# CORS Middleware
# ─────────────────────────────────────────────

# CORS_ORIGINS env'den oku (virgülle ayrılmış liste)
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:5173")
cors_origins = [origin.strip() for origin in cors_origins_str.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# Router'ları Kaydet
# ─────────────────────────────────────────────

app.include_router(onboarding.router, prefix="/api", tags=["Onboarding"])
app.include_router(upload.router, prefix="/api", tags=["PDF Yukleme"])
app.include_router(analysis.router, prefix="/api", tags=["Analiz"])
app.include_router(chat.router, prefix="/api", tags=["Sohbet"])
app.include_router(tcmb.router, prefix="/api", tags=["TCMB"])
app.include_router(goals.router, prefix="/api", tags=["Birikim Hedefleri"])
app.include_router(simulator.router, prefix="/api", tags=["Simülatör"])


# ─────────────────────────────────────────────
# Temel Endpoint'ler
# ─────────────────────────────────────────────

@app.get("/", tags=["Durum"])
async def ana_sayfa():
    """API sağlık kontrolü"""
    return {
        "durum": "ParaPusula API calisiyor",
        "versiyon": "1.0.0",
        "docs": "/docs"
    }


@app.get("/api/health", tags=["Durum"])
async def saglik_kontrolu():
    """Detaylı sağlık kontrolü"""
    firebase_durum = "bilinmiyor"
    try:
        from services.firebase_service import firebase_service
        await firebase_service.tcmb_cache_oku()
        firebase_durum = "bagli"
    except Exception as e:
        firebase_durum = f"hata: {str(e)[:50]}"

    return {
        "durum": "calisiyor",
        "firebase": firebase_durum,
        "gemini_api_key": bool(os.getenv("GEMINI_API_KEY")),
        "tcmb_api_key": bool(os.getenv("TCMB_API_KEY")),
    }


# ─────────────────────────────────────────────
# Sunucu Başlatma (doğrudan çalıştırma)
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
        timeout_keep_alive=300,   # 5 dakika — Gemini pipeline süresi
        h11_max_incomplete_event_size=16 * 1024 * 1024,  # 16MB upload limit
    )
