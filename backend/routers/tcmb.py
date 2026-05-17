"""
ParaPusula - TCMB Veri Router
Merkez Bankası makroekonomik verilerini yenileyen endpoint.
"""

from fastapi import APIRouter, HTTPException
from models.schemas import TCMBData
from services.tcmb_service import tcmb_service
from services.firebase_service import firebase_service

router = APIRouter()


@router.get("/tcmb/refresh", response_model=TCMBData)
async def tcmb_verisi_yenile():
    """
    TCMB EVDS API'sinden taze makroekonomik veri çeker.
    Cache'i atlayarak direkt API'ye gider ve Firestore'u günceller.

    Returns:
        TCMBData: Güncel TÜFE, KFE, azami faiz ve asgari ücret verileri
    """
    try:
        taze_veri = await tcmb_service.taze_veri_zorla(firebase_service)
        return taze_veri

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"TCMB verisi yenilenemedi: {e}"
        )


@router.get("/tcmb/current", response_model=TCMBData)
async def tcmb_mevcut_veri():
    """
    Mevcut TCMB verisini (cache'den veya API'den) döndürür.
    Cache tazeyse API çağrısı yapmaz.

    Returns:
        TCMBData: Güncel veya cache'lenmiş TCMB verileri
    """
    try:
        veri = await tcmb_service.tcmb_verisi_getir(firebase_service)
        return veri

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"TCMB verisi getirilemedi: {e}"
        )
