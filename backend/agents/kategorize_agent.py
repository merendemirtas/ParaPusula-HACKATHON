"""
ParaPusula - Kategorize Agent
LangGraph pipeline'ının ikinci adımı: işlemleri kategorilere ayırır.
"""

from models.schemas import PipelineState
from services.gemini_service import gemini_service


async def kategorize_agent_node(state: PipelineState) -> PipelineState:
    """
    Pipeline'ın kategorizasyon adımı.

    - ham_islemler listesini alır
    - GeminiService üzerinden her işleme kategori atar
    - Abonelikleri tespit eder
    - kategorili_islemler listesini günceller

    Args:
        state: Mevcut pipeline durumu

    Returns:
        PipelineState: Güncellenmiş pipeline durumu
    """
    try:
        ham_islemler = state.get("ham_islemler", [])
        tcmb_verisi = state.get("tcmb_verisi")
        kullanici_profili = state.get("kullanici_profili")

        if not ham_islemler:
            state["hata"] = "Kategorizasyon için işlem listesi boş"
            state["mevcut_adim"] = "kategorize_hata"
            return state

        # Gemini üzerinden kategorize et
        kategorili_islemler = await gemini_service.kategorize_et(
            islemler=ham_islemler,
            tcmb=tcmb_verisi,
            profil=kullanici_profili
        )

        # Tüm kategori ve işlemleri detaylıca logla
        print(f"\n[Kategorize Agent] ─── {len(kategorili_islemler)} kategori oluşturuldu ───")
        for kategori in kategorili_islemler:
            abonelik_durumu = "(abonelik)" if kategori.get("abonelik_mi") else ""
            islemler_listesi = kategori.get("islemler", [])
            print(f"  KATEGORİ: {kategori.get('kategori_adi', '?')} "
                  f"| {kategori.get('toplam_tutar', 0):,.2f} TL "
                  f"| {len(islemler_listesi)} işlem {abonelik_durumu}")
            for i in islemler_listesi:
                faiz_str = f" | faiz: %{i.get('faiz_orani')}" if i.get("faiz_orani") else ""
                print(f"    → {i.get('tarih','')} | {i.get('aciklama','?')[:50]} "
                      f"| {i.get('tutar', 0):,.2f} TL{faiz_str}")
        print(f"[Kategorize Agent] ─────────────────────────────────────\n")

        # State'i güncelle
        state["kategorili_islemler"] = kategorili_islemler
        state["mevcut_adim"] = "kategorize_tamamlandi"
        state["hata"] = None

    except Exception as e:
        state["hata"] = f"Kategorize etme hatası: {e}"
        state["mevcut_adim"] = "kategorize_hata"

    return state
