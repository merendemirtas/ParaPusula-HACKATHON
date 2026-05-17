"""
ParaPusula - PDF Yükleme Router
PDF'i alır, pipeline'ı senkron çalıştırır, Firestore'a yazar, JSON döner.

# KARAR: StreamingResponse yerine senkron JSON kullanıyoruz.
# Axios NDJSON'ı buffer ettiği için streaming'in frontend'e faydası yoktu;
# üstelik generator içindeki hatalar sessizce yutuluyordu.
# Senkron akış: pipeline tamamlanınca 200 veya hata detayıyla 500 döner.
"""

import os
import uuid
import traceback
import aiofiles
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse

from agents.pipeline import pipeline_calistir
from services.firebase_service import firebase_service

router = APIRouter()

TEMP_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "temp")


@router.post("/upload")
async def pdf_yukle(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    banka: str = Form(default="Ziraat"),
):
    """
    PDF banka ekstresini yükler ve pipeline'ı çalıştırır.
    Pipeline tamamlanınca analiz sonucunu döndürür.
    """
    print(f"\n{'='*60}")
    print(f"[UPLOAD] İstek alındı")
    print(f"[UPLOAD] user_id: {user_id!r}")
    print(f"[UPLOAD] banka: {banka!r}")
    print(f"[UPLOAD] dosya: {file.filename!r}")
    print(f"{'='*60}")

    # ── Dosya doğrulamaları ───────────────────────────────────
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        print(f"[UPLOAD] HATA: Geçersiz dosya tipi: {file.filename}")
        raise HTTPException(status_code=400, detail="Sadece PDF dosyası yüklenebilir.")

    icerik = await file.read()
    print(f"[UPLOAD] Dosya boyutu: {len(icerik):,} bytes")

    if len(icerik) == 0:
        raise HTTPException(status_code=400, detail="Yüklenen PDF dosyası boş.")
    if len(icerik) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="PDF 10 MB'dan büyük olamaz.")

    # Banka adını normalize et
    banka = banka.strip().capitalize()
    if banka not in ["Ziraat", "Halkbank"]:
        print(f"[UPLOAD] Bilinmeyen banka '{banka}', Ziraat olarak ayarlandı")
        banka = "Ziraat"

    # ── PDF'i diske kaydet ────────────────────────────────────
    job_id = str(uuid.uuid4())
    os.makedirs(TEMP_DIR, exist_ok=True)

    guvenli_uid = "".join(c for c in user_id if c.isalnum() or c in "-_")
    pdf_yolu = os.path.join(TEMP_DIR, f"{guvenli_uid}_{job_id}.pdf")

    try:
        async with aiofiles.open(pdf_yolu, "wb") as f:
            await f.write(icerik)
        print(f"[UPLOAD] PDF geçici dosyaya kaydedildi: {pdf_yolu}")
    except Exception as e:
        print(f"[UPLOAD] HATA: PDF kaydetme başarısız: {e}")
        raise HTTPException(status_code=500, detail=f"PDF kaydetme hatası: {e}")

    # ── Kullanıcı profilini Firestore'dan al ──────────────────
    profil_dict = None
    try:
        profil = await firebase_service.kullanici_profil_oku(user_id)
        if profil:
            profil_dict = profil.model_dump()
            print(f"[UPLOAD] Kullanıcı profili bulundu: {profil.ana_hedef}")
        else:
            print(f"[UPLOAD] Kullanıcı profili bulunamadı (onboarding yapılmamış olabilir)")
    except Exception as e:
        print(f"[UPLOAD] UYARI: Profil okunamadı (devam ediliyor): {e}")

    # ── Pipeline'ı çalıştır ───────────────────────────────────
    try:
        print(f"[UPLOAD] Pipeline başlatılıyor — job_id: {job_id}")
        sonuc = await pipeline_calistir(
            user_id=user_id,
            pdf_yolu=pdf_yolu,
            banka=banka,
            kullanici_profili=profil_dict
        )

        if sonuc.get("hata"):
            hata = sonuc["hata"]
            print(f"[UPLOAD] Pipeline HATA ile bitti: {hata}")

            # Kota hatası için kullanıcı dostu mesaj
            if "kotası tükendi" in hata or "günlük" in hata.lower():
                raise HTTPException(
                    status_code=503,
                    detail="Gemini API günlük kotası doldu. Lütfen birkaç saat sonra tekrar deneyin."
                )
            if "rate limit" in hata.lower() or "429" in hata:
                raise HTTPException(
                    status_code=429,
                    detail="AI servisi meşgul. Lütfen 1-2 dakika bekleyip tekrar deneyin."
                )
            raise HTTPException(status_code=422, detail=hata)

        print(f"[UPLOAD] Pipeline başarıyla tamamlandı")

        # Snapshot ve öneri sayısını özetle
        snapshot = sonuc.get("snapshot") or {}
        return JSONResponse({
            "basarili": True,
            "job_id": job_id,
            "mesaj": "Analiz tamamlandı.",
            "finansal_skor": snapshot.get("finansal_skor", 0),
            "ay": snapshot.get("ay", ""),
            "oneri_sayisi": len(sonuc.get("oneriler", [])),
        })

    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[UPLOAD] KRITIK HATA:\n{tb}")
        raise HTTPException(status_code=500, detail=f"Beklenmedik hata: {e}")
    finally:
        # Geçici PDF dosyasını her durumda sil
        try:
            if os.path.exists(pdf_yolu):
                os.remove(pdf_yolu)
                print(f"[UPLOAD] Geçici dosya silindi: {pdf_yolu}")
        except Exception:
            pass
