"""
ParaPusula - Veri Zenginleştirme Agent
LangGraph pipeline'ının üçüncü adımı: TCMB makro verilerini çeker.
"""

from models.schemas import PipelineState
from services.tcmb_service import tcmb_service
from services.firebase_service import firebase_service


async def veri_zenginlestirme_agent_node(state: PipelineState) -> PipelineState:
    """
    Pipeline'ın veri zenginleştirme adımı.

    - TCMBService üzerinden güncel makroekonomik verileri çeker
    - Firestore cache'i kullanır (24 saatlik taze veri garantisi)
    - tcmb_verisi'ni state'e ekler

    Args:
        state: Mevcut pipeline durumu

    Returns:
        PipelineState: Güncellenmiş pipeline durumu
    """
    try:
        # TCMB verisini çek (cache öncelikli)
        tcmb_data = await tcmb_service.tcmb_verisi_getir(firebase_service)

        # Dict formatına çevir (JSON serileştirilebilir)
        tcmb_dict = tcmb_data.model_dump()

        print(f"[Veri Zenginleştirme Agent] TCMB verisi alındı:")
        print(f"  - TÜFE: %{tcmb_dict['tufe']}")
        print(f"  - Azami Faiz: %{tcmb_dict['azami_faiz']}")
        print(f"  - Asgari Ücret: {tcmb_dict['asgari_ucret']:,.0f} TL")
        print(f"  - Güncelleme: {tcmb_dict['guncelleme_tarihi']}")

        # State'i güncelle
        state["tcmb_verisi"] = tcmb_dict
        state["mevcut_adim"] = "veri_zenginlestirme_tamamlandi"
        state["hata"] = None

    except Exception as e:
        # TCMB verisi olmadan devam edilebilir, fallback değerleri kullan
        print(f"[Veri Zenginleştirme Agent] Uyarı: TCMB verisi alınamadı, "
              f"fallback kullanılıyor: {e}")
        state["tcmb_verisi"] = {
            "tufe": 65.0,
            "kfe": 34.0,
            "azami_faiz": 4.5,
            "asgari_ucret": 22104.0,
            "guncelleme_tarihi": "fallback"
        }
        state["mevcut_adim"] = "veri_zenginlestirme_tamamlandi"
        # Hata set etme - pipeline devam etmeli
        state["hata"] = None

    return state
