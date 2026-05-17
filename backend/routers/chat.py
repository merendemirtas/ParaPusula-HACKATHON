"""
ParaPusula - Sohbet Router
Kullanıcının finansal verileriyle bağlamsal AI sohbeti sağlar.
"""

from fastapi import APIRouter, HTTPException
from models.schemas import ChatRequest, ChatResponse
from services.gemini_service import gemini_service
from services.firebase_service import firebase_service

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def sohbet_yaniti(istek: ChatRequest):
    """
    Kullanıcının finansal verisine dayalı empatik Türkçe yanıt üretir.

    - Kullanıcının son snapshot'ını ve profilini getirir
    - Gemini'ye bağlam olarak verir
    - Kişiselleştirilmiş yanıt döndürür

    Request Body:
        user_id: Kullanıcı kimliği
        mesaj: Kullanıcının sorusu veya mesajı

    Returns:
        ChatResponse: AI'ın kişiselleştirilmiş Türkçe yanıtı
    """
    if not istek.mesaj or not istek.mesaj.strip():
        raise HTTPException(
            status_code=400,
            detail="Mesaj boş olamaz."
        )

    if len(istek.mesaj) > 2000:
        raise HTTPException(
            status_code=400,
            detail="Mesaj 2000 karakterden uzun olamaz."
        )

    try:
        # Kullanıcı verilerini paralel çek (bağlam için)
        snapshot = None
        profil = None

        try:
            snapshot = await firebase_service.son_snapshot_oku(istek.user_id)
        except Exception:
            pass  # Snapshot yoksa bağlaçsız devam et

        try:
            profil = await firebase_service.kullanici_profil_oku(istek.user_id)
        except Exception:
            pass  # Profil yoksa bağlaçsız devam et

        # Gemini üzerinden yanıt üret
        yanit = await gemini_service.chat_yanit(
            mesaj=istek.mesaj,
            snapshot=snapshot.model_dump() if snapshot else None,
            profil=profil.model_dump() if profil else None
        )

        return ChatResponse(
            yanit=yanit,
            user_id=istek.user_id
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Sohbet yanıtı üretilemedi: {e}"
        )
