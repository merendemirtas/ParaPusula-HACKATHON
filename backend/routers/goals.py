"""
ParaPusula - Birikim Hedefi Router
Kullanıcının finansal hedeflerini ve aylık birikim girişlerini yönetir.
"""

from datetime import datetime
from fastapi import APIRouter, HTTPException

from services.firebase_service import firebase_service

router = APIRouter()


@router.put("/goals/{user_id}/{hedef_id}")
async def hedef_guncelle(user_id: str, hedef_id: str, data: dict):
    """
    Birikim hedefini günceller.
    Body: {"ad": "Yeni İsim", "hedef_tutar": 2000000, "aciklama": "...", "fotograf_url": "..."}
    """
    try:
        ad = data.get("ad")
        if ad is not None and not str(ad).strip():
            raise HTTPException(status_code=400, detail="Hedef adı boş olamaz.")
        if "hedef_tutar" in data and float(data["hedef_tutar"]) <= 0:
            raise HTTPException(status_code=400, detail="Hedef tutarı sıfırdan büyük olmalıdır.")

        await firebase_service.hedef_guncelle(user_id, hedef_id, data)
        return {"basarili": True, "hedef_id": hedef_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hedef güncellenemedi: {e}")


@router.post("/goals/{user_id}")
async def hedef_olustur(user_id: str, data: dict):
    """
    Yeni birikim hedefi oluşturur.
    Body: {"ad": "Araba", "hedef_tutar": 1000000, "aciklama": "...", "fotograf_url": "..."}
    """
    try:
        ad = str(data.get("ad", "")).strip()
        hedef_tutar = float(data.get("hedef_tutar", 0))

        if not ad:
            raise HTTPException(status_code=400, detail="Hedef adı boş olamaz.")
        if hedef_tutar <= 0:
            raise HTTPException(status_code=400, detail="Hedef tutarı sıfırdan büyük olmalıdır.")

        hedef_id = await firebase_service.hedef_kaydet(user_id, {
            "ad":           ad,
            "hedef_tutar":  hedef_tutar,
            "aciklama":     str(data.get("aciklama", "")),
            "fotograf_url": str(data.get("fotograf_url", "")),
        })
        return {"basarili": True, "hedef_id": hedef_id, "ad": ad}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hedef oluşturulamadı: {e}")


@router.get("/goals/{user_id}")
async def hedefleri_getir(user_id: str):
    """Kullanıcının tüm birikim hedeflerini listeler."""
    try:
        hedefler = await firebase_service.hedef_listesi_oku(user_id)
        return {"user_id": user_id, "hedefler": hedefler}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hedefler getirilemedi: {e}")


@router.post("/goals/{user_id}")
async def hedef_olustur(user_id: str, data: dict):
    """
    Yeni birikim hedefi oluşturur.
    Body: {"ad": "Araba", "hedef_tutar": 1000000}
    """
    try:
        ad = str(data.get("ad", "")).strip()
        hedef_tutar = float(data.get("hedef_tutar", 0))

        if not ad:
            raise HTTPException(status_code=400, detail="Hedef adı boş olamaz.")
        if hedef_tutar <= 0:
            raise HTTPException(status_code=400, detail="Hedef tutarı sıfırdan büyük olmalıdır.")

        hedef_id = await firebase_service.hedef_kaydet(user_id, {
            "ad": ad,
            "hedef_tutar": hedef_tutar,
        })
        return {"basarili": True, "hedef_id": hedef_id, "ad": ad}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hedef oluşturulamadı: {e}")


@router.delete("/goals/{user_id}/{hedef_id}")
async def hedef_sil(user_id: str, hedef_id: str):
    """Birikim hedefini siler."""
    try:
        await firebase_service.hedef_sil(user_id, hedef_id)
        return {"basarili": True, "hedef_id": hedef_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hedef silinemedi: {e}")


@router.post("/goals/{user_id}/{hedef_id}/birikim")
async def birikim_ekle(user_id: str, hedef_id: str, data: dict):
    """
    Hedefe aylık birikim ekler. Aynı ay için tekrar girilirse üzerine yazar.
    Body: {"tutar": 10000, "ay": "2026-05"} — ay opsiyonel (bugünün ayı varsayılan)
    """
    try:
        tutar = float(data.get("tutar", 0))
        ay = str(data.get("ay", datetime.now().strftime("%Y-%m")))

        if tutar <= 0:
            raise HTTPException(status_code=400, detail="Birikim tutarı sıfırdan büyük olmalıdır.")

        await firebase_service.birikim_ekle(user_id, hedef_id, ay, tutar)
        return {"basarili": True, "hedef_id": hedef_id, "ay": ay, "tutar": tutar}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Birikim eklenemedi: {e}")
