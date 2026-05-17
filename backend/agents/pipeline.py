"""
ParaPusula - Agent Pipeline Modülü
Tüm agent'ları sıralı olarak çalıştırır.
Her adımı loglar; hata oluşsa bile pipeline devam eder (PDF agent hariç).
"""

import traceback
from typing import Optional, AsyncGenerator
from models.schemas import PipelineState

from agents.pdf_agent import pdf_agent_node
from agents.kategorize_agent import kategorize_agent_node
from agents.veri_zenginlestirme_agent import veri_zenginlestirme_agent_node
from agents.analiz_agent import analiz_agent_node
from agents.oneri_agent import oneri_agent_node


# (node_fonksiyonu, adım_adı, kullanıcı_mesajı, kritik_mi)
PIPELINE_ADIMLARI = [
    (pdf_agent_node,                 "pdf_agent",              "PDF okundu",                   True),
    (kategorize_agent_node,          "categorization",         "Harcamalar kategorize edildi", False),
    (veri_zenginlestirme_agent_node, "enrichment",             "Ekonomik veriler yüklendi",    False),
    (analiz_agent_node,              "analysis",               "Borç haritanız çizildi",       False),
    (oneri_agent_node,               "recommendation",         "Planınız hazırlandı",          False),
]


def _baslangic_state(user_id, pdf_yolu, banka, kullanici_profili) -> PipelineState:
    return {
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
        "kullanici_profili": kullanici_profili,
    }


async def pipeline_calistir(
    user_id: str,
    pdf_yolu: str,
    banka: str = "Ziraat",
    kullanici_profili: Optional[dict] = None,
) -> PipelineState:
    """
    Pipeline'ı sıralı çalıştırır, final state döndürür.
    Her agent başında ve bitişinde log basar.
    """
    state = _baslangic_state(user_id, pdf_yolu, banka, kullanici_profili)

    print(f"\n{'─'*50}")
    print(f"[PIPELINE] Başlıyor | user: {user_id} | banka: {banka}")
    print(f"{'─'*50}")

    for node_fn, adim_adi, mesaj, kritik in PIPELINE_ADIMLARI:
        print(f"\n[PIPELINE] ▶ {adim_adi} başlıyor...")
        try:
            state = await node_fn(state)

            if state.get("hata"):
                print(f"[PIPELINE] ✗ {adim_adi} HATA: {state['hata']}")
                if kritik:
                    print(f"[PIPELINE] Kritik hata — pipeline durduruluyor")
                    break
                else:
                    print(f"[PIPELINE] Kritik değil — devam ediliyor")
                    state["hata"] = None  # Sonraki agent için temizle
            else:
                print(f"[PIPELINE] ✓ {adim_adi} tamamlandı: {mesaj}")

        except Exception as e:
            tb = traceback.format_exc()
            print(f"[PIPELINE] ✗ {adim_adi} EXCEPTION:\n{tb}")
            state["hata"] = f"{adim_adi} hatası: {e}"
            if kritik:
                break
            state["hata"] = None  # Kritik değilse temizle

    print(f"\n[PIPELINE] {'─'*50}")
    print(f"[PIPELINE] Bitti | adim: {state.get('mevcut_adim')} | hata: {state.get('hata')}")
    print(f"[PIPELINE] Snapshot var mı: {state.get('snapshot') is not None}")
    print(f"[PIPELINE] Öneri sayısı: {len(state.get('oneriler', []))}")
    print(f"[PIPELINE] {'─'*50}\n")

    return state


async def pipeline_stream(
    user_id: str,
    pdf_yolu: str,
    banka: str = "Ziraat",
    kullanici_profili: Optional[dict] = None,
) -> AsyncGenerator[dict, None]:
    """
    Pipeline'ı adım adım çalıştırır, her adımdan sonra dict yield eder.
    (Streaming UI için — şu an kullanılmıyor ama ileride lazım olabilir)
    """
    state = _baslangic_state(user_id, pdf_yolu, banka, kullanici_profili)

    for node_fn, adim_adi, mesaj, kritik in PIPELINE_ADIMLARI:
        try:
            state = await node_fn(state)
            if state.get("hata") and kritik:
                yield {"step": adim_adi, "status": "error", "message": state["hata"]}
                return
            yield {"step": adim_adi, "status": "done", "message": mesaj}
        except Exception as e:
            yield {"step": adim_adi, "status": "error", "message": str(e)}
            if kritik:
                return

    yield {
        "step": "pipeline_tamamlandi",
        "status": "done",
        "message": "Analiziniz hazır!",
        "data": {"finansal_skor": (state.get("snapshot") or {}).get("finansal_skor", 0)},
    }
