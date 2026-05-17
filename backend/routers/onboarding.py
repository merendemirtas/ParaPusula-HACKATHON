"""
ParaPusula - Onboarding Router
Kullanıcı profili oluşturma ve kaydetme endpoint'i.
"""

from fastapi import APIRouter, HTTPException
from models.schemas import OnboardingRequest, UserProfile
from services.firebase_service import firebase_service

router = APIRouter()


@router.post("/onboarding")
async def onboarding_tamamla(istek: OnboardingRequest):
    """
    Kullanıcı onboarding formunu işler ve profili Firestore'a kaydeder.

    Request Body:
        user_id: Benzersiz kullanıcı kimliği
        gelir_duzeni: sabit_maas | degisken | ikisi_de
        mevcut_durum: ay_sonu_bitiyor | idare_ediyorum | duzenli_kaliyor
        ana_hedef: borctan_kurtulmak | hedefe_birikim | harcamalari_anlamak
        harcama_aliskanligi: durtüsel | planli_ama_kayiyor | cok_tutumlu

    Returns:
        dict: Başarı mesajı ve user_id
    """
    if not istek.user_id or not istek.user_id.strip():
        raise HTTPException(
            status_code=400,
            detail="Kullanıcı kimliği (user_id) boş olamaz."
        )

    try:
        # UserProfile modeli oluştur
        profil = UserProfile(
            user_id=istek.user_id.strip(),
            gelir_duzeni=istek.gelir_duzeni,
            mevcut_durum=istek.mevcut_durum,
            ana_hedef=istek.ana_hedef,
            harcama_aliskanligi=istek.harcama_aliskanligi
        )

        # Firestore'a kaydet
        await firebase_service.kullanici_profil_kaydet(profil)

        print(f"[Onboarding] Yeni profil kaydedildi - Kullanıcı: {profil.user_id}")
        print(f"  - Gelir Düzeni: {profil.gelir_duzeni}")
        print(f"  - Ana Hedef: {profil.ana_hedef}")

        return {
            "basarili": True,
            "user_id": profil.user_id,
            "mesaj": "Profiliniz başarıyla oluşturuldu. Şimdi banka ekstrenizi yükleyebilirsiniz.",
            "profil": {
                "gelir_duzeni": profil.gelir_duzeni,
                "mevcut_durum": profil.mevcut_durum,
                "ana_hedef": profil.ana_hedef,
                "harcama_aliskanligi": profil.harcama_aliskanligi,
                "olusturulma_tarihi": profil.olusturulma_tarihi
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Profil kaydedilemedi: {e}"
        )
