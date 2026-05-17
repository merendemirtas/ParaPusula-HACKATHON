"""
ParaPusula - LangGraph Pipeline Orkestrasyonu
5 agent node'u sıralı olarak çalıştıran ana pipeline.
Hata durumunda pipeline güvenli şekilde sonlanır.
"""

from typing import Optional
from langgraph.graph import StateGraph, END

from models.schemas import PipelineState
from agents.pdf_agent import pdf_agent_node
from agents.kategorize_agent import kategorize_agent_node
from agents.veri_zenginlestirme_agent import veri_zenginlestirme_agent_node
from agents.analiz_agent import analiz_agent_node
from agents.oneri_agent import oneri_agent_node


# ─────────────────────────────────────────────
# Hata kontrolü için yardımcı fonksiyon
# ─────────────────────────────────────────────

def hata_kontrol(state: PipelineState) -> str:
    """
    Her node'dan sonra çalışan conditional edge fonksiyonu.
    Hata varsa pipeline'ı güvenli şekilde sonlandırır.

    Returns:
        "devam": Bir sonraki node'a geç
        "hata_sonu": END'e git
    """
    if state.get("hata"):
        print(f"[Pipeline] Hata tespit edildi, pipeline durduruluyor: {state['hata']}")
        return "hata_sonu"
    return "devam"


# ─────────────────────────────────────────────
# LangGraph Pipeline Tanımı
# ─────────────────────────────────────────────

def pipeline_olustur() -> StateGraph:
    """
    LangGraph StateGraph ile 5 node'lu pipeline oluşturur.
    Sıra: pdf → kategorize → veri_zenginlestirme → analiz → oneri → END

    Returns:
        Derlenmiş LangGraph pipeline
    """
    # StateGraph oluştur
    workflow = StateGraph(PipelineState)

    # ── Node'ları ekle ──────────────────────────────
    workflow.add_node("pdf_agent", pdf_agent_node)
    workflow.add_node("kategorize_agent", kategorize_agent_node)
    workflow.add_node("veri_zenginlestirme_agent", veri_zenginlestirme_agent_node)
    workflow.add_node("analiz_agent", analiz_agent_node)
    workflow.add_node("oneri_agent", oneri_agent_node)

    # ── Başlangıç noktası ───────────────────────────
    workflow.set_entry_point("pdf_agent")

    # ── Conditional edge'ler (hata kontrolü) ────────
    # pdf_agent'dan sonra
    workflow.add_conditional_edges(
        "pdf_agent",
        hata_kontrol,
        {
            "devam": "kategorize_agent",
            "hata_sonu": END
        }
    )

    # kategorize_agent'dan sonra
    workflow.add_conditional_edges(
        "kategorize_agent",
        hata_kontrol,
        {
            "devam": "veri_zenginlestirme_agent",
            "hata_sonu": END
        }
    )

    # veri_zenginlestirme_agent'dan sonra
    workflow.add_conditional_edges(
        "veri_zenginlestirme_agent",
        hata_kontrol,
        {
            "devam": "analiz_agent",
            "hata_sonu": END
        }
    )

    # analiz_agent'dan sonra
    workflow.add_conditional_edges(
        "analiz_agent",
        hata_kontrol,
        {
            "devam": "oneri_agent",
            "hata_sonu": END
        }
    )

    # oneri_agent'dan sonra her zaman END'e git
    workflow.add_edge("oneri_agent", END)

    return workflow.compile()


# ─────────────────────────────────────────────
# Pipeline çalıştırma fonksiyonu
# ─────────────────────────────────────────────

async def calistir_pipeline(
    user_id: str,
    pdf_yolu: str,
    kullanici_profili: Optional[dict] = None,
    banka: str = "Ziraat"
) -> dict:
    """
    Ana pipeline'ı başlatır ve sonucu döndürür.

    Args:
        user_id: Kullanıcının benzersiz kimliği
        pdf_yolu: Yüklenen PDF'in sunucu dosya yolu
        kullanici_profili: Onboarding'den gelen profil verisi (dict)
        banka: "Ziraat" veya "Halkbank"

    Returns:
        dict: Pipeline'ın son durumu (PipelineState)
    """
    # Başlangıç durumu oluştur
    baslangic_durumu: PipelineState = {
        "user_id": user_id,
        "pdf_dosya_yolu": pdf_yolu,
        "banka": banka,
        "ham_islemler": [],
        "kategorili_islemler": [],
        "tcmb_verisi": None,
        "snapshot": None,
        "oneriler": [],
        "borc_cikis_plani": None,
        "hata": None,
        "mevcut_adim": "baslangic",
        "kullanici_profili": kullanici_profili
    }

    print(f"\n{'='*50}")
    print(f"[Pipeline] Başlatılıyor - Kullanıcı: {user_id}")
    print(f"[Pipeline] PDF: {pdf_yolu}")
    print(f"[Pipeline] Banka: {banka}")
    print(f"{'='*50}\n")

    try:
        # Pipeline'ı oluştur ve çalıştır
        pipeline = pipeline_olustur()
        sonuc_durumu = await pipeline.ainvoke(baslangic_durumu)

        # Tamamlanma durumunu logla
        if sonuc_durumu.get("hata"):
            print(f"\n[Pipeline] HATA ile tamamlandı: {sonuc_durumu['hata']}")
        else:
            adim = sonuc_durumu.get("mevcut_adim", "bilinmiyor")
            print(f"\n[Pipeline] Başarıyla tamamlandı - Son adım: {adim}")

        return sonuc_durumu

    except Exception as e:
        print(f"\n[Pipeline] Kritik hata: {e}")
        baslangic_durumu["hata"] = f"Kritik pipeline hatası: {e}"
        baslangic_durumu["mevcut_adim"] = "kritik_hata"
        return baslangic_durumu
