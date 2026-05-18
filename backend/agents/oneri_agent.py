"""
ParaPusula - Öneri Agent
LangGraph pipeline'ının son adımı: aksiyon önerileri ve borç çıkış planı üretir.
"""

from models.schemas import PipelineState
from services.gemini_service import gemini_service
from services.firebase_service import firebase_service
from agents.analiz_agent import borc_cikis_plani_hesapla


async def oneri_agent_node(state: PipelineState) -> PipelineState:
    """
    Pipeline'ın öneri üretme adımı.

    - GeminiService üzerinden 3 somut aksiyon önerisi üretir
    - Borç çıkış planı oluşturur (Avalanche veya Snowball)
    - Snapshot'ı önerilerle günceller
    - Pipeline'ı tamamlar

    Args:
        state: Mevcut pipeline durumu

    Returns:
        PipelineState: Güncellenmiş pipeline durumu
    """
    try:
        snapshot = state.get("snapshot")
        kullanici_profili = state.get("kullanici_profili")
        tcmb_verisi = state.get("tcmb_verisi")
        user_id = state.get("user_id", "")

        if not snapshot:
            state["hata"] = "Öneri üretimi için snapshot bulunamadı"
            state["mevcut_adim"] = "oneri_hata"
            return state

        # Gemini üzerinden öneriler ve borç planı üret
        oneri_sonucu = await gemini_service.oneri_uret(
            snapshot=snapshot,
            profil=kullanici_profili,
            tcmb=tcmb_verisi
        )

        oneriler = oneri_sonucu.get("oneriler", [])
        borc_cikis_plani = oneri_sonucu.get("borc_cikis_plani")

        # Gemini'nin önerdiği ekstra ödeme miktarını al, ay-ay tabloyu deterministik üret
        borc_listesi = snapshot.get("borc_listesi", [])
        if borc_listesi:
            ekstra = float((borc_cikis_plani or {}).get("aylik_ekstra_odeme", 0)) or 1000
            borc_cikis_plani = borc_cikis_plani_hesapla(borc_listesi, ekstra, max_ay=24)
            print(f"[Öneri Agent] Borç çıkış planı: {len(borc_cikis_plani['adimlar'])} aylık adım üretildi")

        # Snapshot'ı önerilerle güncelle (Firestore'da)
        ay = snapshot.get("ay", "")
        if ay and user_id:
            try:
                await firebase_service.analiz_guncelle(
                    user_id=user_id,
                    ay=ay,
                    oneriler=oneriler,
                    borc_plan=borc_cikis_plani
                )
            except Exception as firebase_hata:
                # Firestore güncelleme hatası pipeline'ı durdurmasın
                print(f"[Öneri Agent] Firestore güncelleme uyarısı: {firebase_hata}")

        print(f"[Öneri Agent] {len(oneriler)} öneri üretildi")
        for oneri in oneriler:
            print(f"  [{oneri.get('oncelik', '?')}] {oneri.get('baslik', '')}")

        if borc_cikis_plani:
            yontem = borc_cikis_plani.get("yontem", "bilinmiyor")
            toplam = borc_cikis_plani.get("toplam_borc", 0)
            bitis = borc_cikis_plani.get("tahmini_bitis_ay", "")
            print(f"[Öneri Agent] Borç planı: {yontem} - "
                  f"{toplam:,.0f} TL - Bitiş: {bitis}")

        # State'i güncelle
        state["oneriler"] = oneriler
        state["borc_cikis_plani"] = borc_cikis_plani
        state["mevcut_adim"] = "pipeline_tamamlandi"
        state["hata"] = None

    except Exception as e:
        state["hata"] = f"Öneri üretme hatası: {e}"
        state["mevcut_adim"] = "oneri_hata"

    return state
