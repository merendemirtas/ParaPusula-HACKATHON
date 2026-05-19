// KARAR: Borç çıkış planı accordion default açık (kullanıcı bilgiyi hemen görsün); auth uid kullanılıyor.
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAnalysis, getTCMBLatest, updateBorcFaiz } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import EmptyState from './EmptyState.jsx'

const paraDuzenle = (sayi) => {
  if (!sayi && sayi !== 0) return '0 ₺'
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .format(Math.abs(sayi)) + ' ₺'
}

const SINIF = {
  stratejik:     { renk: 'var(--color-primary-dark)', etiket: 'Stratejik',     aciklama: 'Değer yaratan borç — eviniz borçtan hızlı değerleniyor',
    badgeCls: 'badge-positive', barRenk: 'var(--color-primary)' },
  yonetilebilir: { renk: 'var(--color-warning)', etiket: 'Yönetilebilir', aciklama: 'Kontrol altında — ödeme planına devam et',
    badgeCls: 'badge-warning',  barRenk: 'var(--color-warning)' },
  kritik:        { renk: 'var(--color-negative)', etiket: 'Kritik',        aciklama: 'Öncelikli öde — faiz birikimi hızlanıyor',
    badgeCls: 'badge-negative', barRenk: 'var(--color-negative)' },
  gri:  { renk: 'var(--color-warning)', etiket: 'Yönetilebilir', aciklama: 'Kontrol altında — ödeme planına devam et',
    badgeCls: 'badge-warning',  barRenk: 'var(--color-warning)' },
  kotu: { renk: 'var(--color-negative)', etiket: 'Kritik',        aciklama: 'Öncelikli öde — faiz birikimi hızlanıyor',
    badgeCls: 'badge-negative', barRenk: 'var(--color-negative)' },
}

// ─── Client-side borç planı hesaplayıcı ──────────────────────
// KARAR: Backend planı her zaman Avalanche üretir. Snowball için frontend yeniden hesaplar.
function hesaplaBorcPlani(borcListesi, ekstraOdeme, yontem, maxAy = 120) {
  const aktif = borcListesi.filter(b => b.ana_para > 0 && b.aylik_odeme > 0)
  if (!aktif.length) return { adimlar: [], toplam_faiz: 0 }

  const borclar = aktif.map(b => ({
    aciklama:    b.aciklama,
    kalan:       b.ana_para,
    aylik_faiz:  ((b.faiz_orani || 36) / 100) / 12,
    min_odeme:   b.aylik_odeme,
  }))

  if (yontem === 'snowball') {
    borclar.sort((a, b) => a.kalan - b.kalan)          // küçük ana paradan başla
  } else {
    borclar.sort((a, b) => b.aylik_faiz - a.aylik_faiz) // yüksek faizden başla
  }

  let serbest_ekstra = ekstraOdeme
  let toplam_faiz = 0
  const adimlar = []
  const bugun = new Date()

  for (let n = 0; n < maxAy; n++) {
    const d = new Date(bugun.getFullYear(), bugun.getMonth() + n, 1)
    const ay_str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    let ay_odeme = 0

    for (const b of borclar) {
      if (b.kalan <= 0) continue
      const faiz = b.kalan * b.aylik_faiz
      toplam_faiz += faiz
      b.kalan += faiz
      const odeme = Math.min(b.min_odeme, b.kalan)
      b.kalan -= odeme
      ay_odeme += odeme
    }

    let ekstra_kalan = serbest_ekstra
    for (const b of borclar) {
      if (b.kalan <= 0 || ekstra_kalan <= 0) continue
      const uygula = Math.min(ekstra_kalan, b.kalan)
      b.kalan -= uygula
      ekstra_kalan -= uygula
      ay_odeme += uygula
      if (b.kalan <= 0.01) { serbest_ekstra += b.min_odeme; b.kalan = 0 }
      break
    }
    for (const b of borclar) {
      if (b.kalan > 0 && b.kalan <= 0.01) { serbest_ekstra += b.min_odeme; b.kalan = 0 }
    }

    const toplam_kalan = borclar.reduce((s, b) => s + Math.max(0, b.kalan), 0)
    adimlar.push({ ay: ay_str, odeme_tutari: Math.round(ay_odeme), kalan_borc: Math.round(toplam_kalan) })
    if (toplam_kalan <= 0.01) break
  }

  return { adimlar, toplam_faiz: Math.round(toplam_faiz) }
}

export default function DebtMap() {
  const navigate = useNavigate()
  const { kullanici } = useAuth()
  const userId = kullanici?.uid || localStorage.getItem('parapusula_user_id') || ''
  const { addToast } = useToast()

  const [analiz, setAnaliz] = useState(null)
  const [tcmbVerisi, setTcmbVerisi] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState('')
  const [planAcik, setPlanAcik] = useState(true)
  const [planYontem, setPlanYontem] = useState('avalanche') // 'avalanche' | 'snowball'
  // editFaiz: { [index]: inputValue } — hangi kart edit modunda
  const [editFaiz, setEditFaiz] = useState({})
  const [savingFaiz, setSavingFaiz] = useState({})

  async function faizKaydet(index, borc) {
    const deger = parseFloat((editFaiz[index] || '').replace(',', '.'))
    if (!deger || deger <= 0 || deger > 500) {
      addToast('Geçerli bir faiz oranı girin (0-500 arası)', 'error')
      return
    }
    setSavingFaiz(s => ({ ...s, [index]: true }))
    try {
      const sonuc = await updateBorcFaiz(userId, borc.aciklama, deger)

      // Backend güncel borc_listesi dönüyorsa onu kullan (siniflandirma dahil)
      // Dönmüyorsa ya da eksikse full re-fetch yap
      if (sonuc?.guncellenen_borclar?.length) {
        setAnaliz(prev => ({
          ...prev,
          borc_listesi: sonuc.guncellenen_borclar,
          finansal_skor: sonuc.yeni_finansal_skor ?? prev.finansal_skor,
        }))
      } else {
        // Fallback: Firestore'dan taze veriyi çek
        const taze = await getAnalysis(userId)
        setAnaliz(taze)
      }

      setEditFaiz(e => { const n = { ...e }; delete n[index]; return n })
      addToast('Faiz oranı güncellendi ✓', 'success')
    } catch (e) {
      addToast(e.message || 'Kaydedilemedi', 'error')
    } finally {
      setSavingFaiz(s => { const n = { ...s }; delete n[index]; return n })
    }
  }

  useEffect(() => {
    if (!userId) return
    setYukleniyor(true)
    Promise.all([
      getAnalysis(userId),
      getTCMBLatest().catch(() => null),
    ])
      .then(([analizData, tcmb]) => {
        setAnaliz(analizData)
        setTcmbVerisi(tcmb)
      })
      .catch(err => setHata(err.message?.includes('404') ? 'yok' : err.message))
      .finally(() => setYukleniyor(false))
  }, [userId])

  if (yukleniyor) {
    return (
      <div style={sayfaStil}>
        <div style={konteynerStil}>
          <div className="skeleton" style={{ height: 40, width: '40%', marginBottom: 24 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            <div className="skeleton" style={{ height: 110 }} />
            <div className="skeleton" style={{ height: 110 }} />
            <div className="skeleton" style={{ height: 110 }} />
          </div>
          <div className="skeleton" style={{ height: 180, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 180 }} />
        </div>
      </div>
    )
  }

  if (hata === 'yok' || !analiz) {
    return (
      <div style={sayfaStil}>
        <div style={konteynerStil}>
          <EmptyState
            icon={<svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" /><path d="M12 7v10M9 9.5c0-1.4 1.3-2 3-2s3 0.6 3 2-1.3 2-3 2-3 0.6-3 2 1.3 2 3 2 3-0.6 3-2" />
            </svg>}
            baslik="Henüz borç haritan yok"
            aciklama="Borç haritanı çıkarmak için banka ekstreni yükle."
            action={<button onClick={() => navigate('/upload')} className="btn btn-primary btn-lg">PDF Yükle</button>}
          />
        </div>
      </div>
    )
  }

  const borcListesi = analiz.borc_listesi || []
  const borcCikisPlan = analiz.borc_cikis_plani

  const toplamBorc = borcListesi.reduce((t, b) => t + (b.ana_para || 0), 0)
  const aylikToplamOdeme = borcListesi.reduce((t, b) => t + (b.aylik_odeme || 0), 0)

  return (
    <div style={sayfaStil}>
      <div style={konteynerStil}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 className="heading-lg">Borç Haritam</h1>
          <p className="text-body" style={{ marginTop: 4 }}>
            Borçlarını sınıflandır, en hızlı çıkış stratejini bul.
          </p>
        </div>

        {borcListesi.length === 0 ? (
          <EmptyState
            icon={<svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="var(--color-positive)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>}
            baslik="Borç tespit edilmedi"
            aciklama="Analize göre aktif borç ya da taksit ödemen bulunmuyor. Devam et!"
          />
        ) : (
          <>
            {/* 3 metrik */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
              <MetrikKart etiket="Toplam Borç" deger={paraDuzenle(toplamBorc)} renk="var(--color-negative)" />
              <MetrikKart etiket="Aylık Toplam Ödeme" deger={paraDuzenle(aylikToplamOdeme)} renk="var(--color-warning)" />
              <MetrikKart etiket="Borç Sayısı" deger={`${borcListesi.length} adet`} renk="var(--color-primary)" />
            </div>

            {/* Sınıflandırma ve Veri Kaynağı */}
            <SiniflandirmaKutusu tcmb={tcmbVerisi} />

            {/* Borç kartları */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
              {borcListesi.map((borc, i) => {
                const sinif = SINIF[borc.siniflandirma] || SINIF.gri
                const odenmislik = borc.kalan_taksit > 0
                  ? Math.max(0, Math.min(100, 100 - (borc.kalan_taksit / (borc.kalan_taksit + 6)) * 100))
                  : 0

                return (
                  <div key={i} className="card card-interactive" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {borc.aciklama}
                          </h3>
                          <span className={`badge ${sinif.badgeCls}`}>{sinif.etiket}</span>
                        </div>
                        <p className="text-small" style={{ margin: 0 }}>{sinif.aciklama}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="heading-sm" style={{ color: sinif.renk }}>
                          {paraDuzenle(borc.aylik_odeme)}
                        </div>
                        <p className="text-tiny" style={{ margin: 0 }}>aylık</p>
                      </div>
                    </div>

                    {/* Alt metrikler */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 16, marginBottom: 16 }}>
                      <MiniMetrik etiket="Ana Para" deger={paraDuzenle(borc.ana_para)} />

                      {/* Faiz oranı — bilinmiyorsa sarı uyarı + inline edit */}
                      <div>
                        <p className="text-tiny" style={{ margin: '0 0 4px' }}>Faiz</p>
                        {borc.faiz_orani ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                              %{borc.faiz_orani.toFixed(1)} yıllık
                            </span>
                            <button
                              onClick={() => setEditFaiz(e => ({ ...e, [i]: String(borc.faiz_orani) }))}
                              title="Düzenle"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}
                            >✏️</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditFaiz(e => ({ ...e, [i]: '' }))}
                            style={{
                              background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.35)',
                              borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
                              fontSize: 12, fontWeight: 600, color: 'var(--color-warning)', fontFamily: 'inherit',
                              display: 'flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            ⚠ Bilinmiyor — girin
                          </button>
                        )}
                        {editFaiz.hasOwnProperty(i) && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                            <input
                              type="number"
                              step="0.1"
                              placeholder="Örn: 42.5"
                              value={editFaiz[i]}
                              onChange={e => setEditFaiz(f => ({ ...f, [i]: e.target.value }))}
                              autoFocus
                              style={{
                                width: 90, padding: '6px 8px', fontSize: 13,
                                border: '1.5px solid var(--color-primary)', borderRadius: 8,
                                background: 'var(--bg-surface)', color: 'var(--text-primary)',
                                fontFamily: 'inherit', outline: 'none',
                              }}
                            />
                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>%/yıl</span>
                            <button
                              onClick={() => faizKaydet(i, borc)}
                              disabled={savingFaiz[i]}
                              className="btn btn-primary"
                              style={{ padding: '5px 12px', fontSize: 12 }}
                            >
                              {savingFaiz[i] ? '...' : 'Kaydet'}
                            </button>
                            <button
                              onClick={() => setEditFaiz(e => { const n = { ...e }; delete n[i]; return n })}
                              className="btn btn-ghost"
                              style={{ padding: '5px 8px', fontSize: 12 }}
                            >İptal</button>
                          </div>
                        )}
                      </div>

                      <MiniMetrik etiket="Kalan Taksit" deger={`${borc.kalan_taksit} ay`} />
                    </div>

                    {/* Faiz bilinmiyorsa kart altında tam genişlik uyarı */}
                    {!borc.faiz_orani && !editFaiz.hasOwnProperty(i) && (
                      <div style={{
                        padding: '8px 14px', marginBottom: 12,
                        background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)',
                        borderRadius: 8, fontSize: 12, color: 'var(--color-warning)', display: 'flex',
                        justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <span>⚠ Faiz oranı bilinmiyor — simülatör için girin</span>
                        <button
                          onClick={() => setEditFaiz(e => ({ ...e, [i]: '' }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 12, fontWeight: 600, color: 'var(--color-warning)', fontFamily: 'inherit' }}
                        >Girin →</button>
                      </div>
                    )}

                    {/* Toplam Maliyet Analizi — faiz biliniyorsa göster */}
                    {borc.faiz_orani > 0 && (() => {
                      // KARAR: Amortizasyon formülüyle gerçek kalan taksit sayısını hesapla.
                      // kalan_taksit=24 bizim tahminimiz; faiz+ödeme bilinince doğruyu buluruz.
                      const r = borc.faiz_orani / 12 / 100
                      const P = borc.ana_para
                      const M = borc.aylik_odeme
                      let kalanAy = borc.kalan_taksit
                      if (r > 0 && M > P * r) {
                        kalanAy = Math.ceil(-Math.log(1 - (P * r) / M) / Math.log(1 + r))
                      }
                      const kalanToplam = Math.round(M * kalanAy)
                      const kalanFaiz   = Math.max(0, kalanToplam - Math.round(P))
                      return (
                        <div style={{
                          borderTop: '1px solid var(--border-subtle)',
                          marginTop: 16, paddingTop: 16, marginBottom: 12,
                        }}>
                          <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700,
                            color: 'var(--text-tertiary)', letterSpacing: '.06em',
                            textTransform: 'uppercase' }}>
                            Toplam Maliyet Analizi
                          </p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
                            <MalivetSatir etiket="Kalan Ödemeler" deger={`${new Intl.NumberFormat('tr-TR').format(kalanToplam)} ₺`} />
                            <MalivetSatir etiket="Ana Para" deger={`${new Intl.NumberFormat('tr-TR').format(Math.round(P))} ₺`} />
                            <div title="Bu parayı başka bir yere yatırsaydınız, bu kadar getiri elde edebilirdiniz.">
                              <MalivetSatir
                                etiket="Faiz Maliyeti (?)"
                                deger={`${new Intl.NumberFormat('tr-TR').format(kalanFaiz)} ₺`}
                                vurgu
                              />
                            </div>
                            <MalivetSatir
                              etiket={`${kalanAy} ay kaldı`}
                              deger={`~${Math.ceil(kalanAy / 12)} yıl`}
                              kucuk
                            />
                          </div>
                        </div>
                      )
                    })()}

                    {/* Progress bar */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span className="text-tiny">Ödeme İlerlemesi</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                          %{odenmislik.toFixed(0)}
                        </span>
                      </div>
                      <div style={{
                        height: 6, background: 'var(--border-subtle)',
                        borderRadius: 'var(--radius-full)', overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', width: `${odenmislik}%`,
                          background: sinif.barRenk,
                          borderRadius: 'var(--radius-full)',
                          transition: 'width 600ms cubic-bezier(0.4,0,0.2,1)',
                        }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Borç çıkış planı */}
            {borcListesi.length > 0 && (() => {
              const ekstra = borcCikisPlan?.aylik_ekstra_odeme || 1000
              const baslangic_borc = borcListesi.reduce((s, b) => s + b.ana_para, 0)
              const mevcut_skor = analiz.finansal_skor || 60

              const avalanchePlan  = hesaplaBorcPlani(borcListesi, ekstra, 'avalanche')
              const snowballPlan   = hesaplaBorcPlani(borcListesi, ekstra, 'snowball')
              const aktifPlan      = planYontem === 'avalanche' ? avalanchePlan : snowballPlan
              const farkFaiz       = snowballPlan.toplam_faiz - avalanchePlan.toplam_faiz

              return (
                <div className="card" style={{ padding: 28 }}>
                  {/* Başlık + toggle */}
                  <button
                    onClick={() => setPlanAcik(!planAcik)}
                    style={{
                      width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      padding: 0, fontFamily: 'inherit', textAlign: 'left',
                    }}
                  >
                    <div>
                      <p className="text-tiny" style={{ color: 'var(--color-primary)', marginBottom: 4 }}>STRATEJİ</p>
                      <h2 className="heading-sm">Borç Çıkış Planı</h2>
                    </div>
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      style={{ transform: planAcik ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform var(--transition-base)', flexShrink: 0 }}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  {planAcik && (
                    <div className="animate-fade-in" style={{ marginTop: 20 }}>
                      {/* Yöntem Seçimi */}
                      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                        {[
                          { key: 'avalanche', etiket: '⚡ Avalanche', aciklama: 'En yüksek faizden başla' },
                          { key: 'snowball',  etiket: '⛄ Snowball',  aciklama: 'En küçük borçtan başla' },
                        ].map(y => (
                          <button
                            key={y.key}
                            onClick={() => setPlanYontem(y.key)}
                            style={{
                              padding: '8px 18px', borderRadius: 'var(--radius-sm)',
                              border: planYontem === y.key
                                ? '2px solid var(--color-primary)'
                                : '2px solid var(--border-default)',
                              background: planYontem === y.key ? 'var(--color-primary-light)' : 'var(--bg-card)',
                              color: planYontem === y.key ? 'var(--color-primary-dark)' : 'var(--text-secondary)',
                              fontWeight: planYontem === y.key ? 700 : 500,
                              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                              transition: 'all 150ms ease',
                            }}
                          >
                            {y.etiket}
                          </button>
                        ))}
                      </div>

                      {/* Faiz farkı notu */}
                      {farkFaiz > 0 && (
                        <div style={{
                          marginBottom: 16, padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                          background: 'var(--color-warning-light)', border: '1px solid var(--color-warning)',
                          fontSize: 12, color: 'var(--color-warning)',
                        }}>
                          💡 Snowball seçersen Avalanche'a göre <strong>{paraDuzenle(farkFaiz)}</strong> fazla faiz ödersin
                        </div>
                      )}

                      {/* Metrikler */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
                        <MiniMetrik etiket="Toplam Borç" deger={paraDuzenle(baslangic_borc)} />
                        <MiniMetrik etiket="Aylık Ekstra Ödeme" deger={paraDuzenle(ekstra)} />
                        <MiniMetrik etiket="Toplam Faiz" deger={paraDuzenle(aktifPlan.toplam_faiz)} />
                        <MiniMetrik etiket="Süre" deger={`${aktifPlan.adimlar.length} ay`} />
                      </div>

                      {/* Ay-ay tablo */}
                      {aktifPlan.adimlar.length > 0 && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                              Ay-Ay Ödeme Planı ({planYontem === 'avalanche' ? 'Avalanche' : 'Snowball'})
                            </h3>
                            <span className="text-tiny">{aktifPlan.adimlar.length} ay</span>
                          </div>
                          <div style={{
                            overflowX: 'auto', maxHeight: 480, overflowY: 'auto',
                            border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                          }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }}>
                                <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                                  <Th>Ay</Th>
                                  <Th align="right">Ödeme</Th>
                                  <Th align="right">Kalan Borç</Th>
                                  <Th align="right">Tahmini Skor</Th>
                                </tr>
                              </thead>
                              <tbody>
                                {aktifPlan.adimlar.map((adim, i) => {
                                  const odendi_oran = baslangic_borc > 0
                                    ? (baslangic_borc - adim.kalan_borc) / baslangic_borc
                                    : 0
                                  const skor_tahmini = Math.min(100, Math.round(mevcut_skor + 25 * odendi_oran))
                                  const skor_renk = skor_tahmini >= 81 ? 'var(--color-positive)'
                                    : skor_tahmini >= 61 ? 'var(--color-primary)'
                                    : skor_tahmini >= 41 ? 'var(--color-warning)'
                                    : 'var(--color-negative)'
                                  return (
                                    <tr key={i} style={{
                                      borderBottom: '1px solid var(--border-subtle)',
                                      background: adim.kalan_borc === 0 ? 'rgba(53,107,89,0.04)' : 'transparent',
                                    }}>
                                      <Td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{adim.ay}</Td>
                                      <Td align="right" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                                        {paraDuzenle(adim.odeme_tutari)}
                                      </Td>
                                      <Td align="right" style={{
                                        color: adim.kalan_borc === 0 ? 'var(--color-positive)' : 'var(--text-secondary)',
                                        fontWeight: adim.kalan_borc === 0 ? 600 : 400,
                                      }}>
                                        {adim.kalan_borc === 0 ? '✓ Bitti' : paraDuzenle(adim.kalan_borc)}
                                      </Td>
                                      <Td align="right">
                                        <span style={{ fontWeight: 600, color: skor_renk }}>{skor_tahmini}</span>
                                        {i > 0 && skor_tahmini > Math.min(100, Math.round(mevcut_skor + 25 * ((baslangic_borc - aktifPlan.adimlar[i-1].kalan_borc) / (baslangic_borc || 1)))) && (
                                          <span style={{ fontSize: 10, color: 'var(--color-positive)', marginLeft: 4 }}>▲</span>
                                        )}
                                      </Td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}
          </>
        )}
      </div>
    </div>
  )
}

function SiniflandirmaKutusu({ tcmb }) {
  const [tooltip, setTooltip] = useState(null)

  const tufe     = tcmb?.tufe        ?? 30.65
  const kfe      = tcmb?.kfe         ?? 34.0
  const azami    = tcmb?.azami_faiz  ?? 5.13
  const tarih    = tcmb?.guncelleme_tarihi
    ? new Date(tcmb.guncelleme_tarihi).toLocaleDateString('tr-TR')
    : '—'
  const kfeFallback = !tcmb?.kfe

  const siniflar = [
    {
      renk: 'var(--color-primary-dark)', bg: 'var(--color-positive-light)',
      baslik: 'STRATEJİK',
      alt: `Konut kredisi + Faiz < KFE (%${kfe.toFixed(1)})`,
      aciklama: 'Değer yaratan borç',
      ipucu: 'Eviniz KFE kadar değerleniyor; kredinizin faizi bu değerlenmeden az — borçlanma size net servet yaratıyor.',
    },
    {
      renk: 'var(--color-warning)', bg: 'var(--color-warning-light)',
      baslik: 'YÖNETİLEBİLİR',
      alt: `Faiz < TÜFE (%${tufe.toFixed(1)})`,
      aciklama: 'Enflasyon borcu eritiyor',
      ipucu: 'Faiz oranınız enflasyonun altında — paranın satın alma gücü düşerken borcunuz görece küçülüyor.',
    },
    {
      renk: 'var(--color-negative)', bg: 'var(--color-negative-light)',
      baslik: 'KRİTİK',
      alt: `Faiz ≥ TÜFE (%${tufe.toFixed(1)})`,
      aciklama: 'Öncelikli öde',
      ipucu: 'Faiz oranı enflasyonun üzerinde — her ay gerçek değerde yükümlülüğünüz büyüyor. Bu borcu önce bitir.',
    },
  ]

  return (
    <div
      style={{
        background: '#F8FAFC',
        border: '1px solid var(--border-subtle)',
        borderRadius: 16,
        padding: '20px 24px',
        marginBottom: 28,
        transition: 'box-shadow 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
    >
      {/* Üst: 3 sınıf yan yana */}
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {siniflar.map((s, i) => (
          <React.Fragment key={s.baslik}>
            <div style={{ flex: 1, minWidth: 160, padding: '0 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{
                  background: s.bg, color: s.renk,
                  borderRadius: 20, padding: '3px 10px',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                }}>
                  {s.baslik}
                </span>
                <span
                  style={{ position: 'relative', cursor: 'default' }}
                  onMouseEnter={() => setTooltip(i)}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', userSelect: 'none' }}>(?)</span>
                  {tooltip === i && (
                    <div style={{
                      position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#1e293b', color: '#fff',
                      borderRadius: 8, padding: '8px 12px',
                      fontSize: 12, width: 220, lineHeight: 1.5,
                      zIndex: 100, whiteSpace: 'normal',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    }}>
                      {s.ipucu}
                    </div>
                  )}
                </span>
              </div>
              <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-secondary)' }}>{s.alt}</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: s.renk }}>{s.aciklama}</p>
            </div>
            {i < siniflar.length - 1 && (
              <div style={{ width: 1, background: 'var(--border-subtle)', alignSelf: 'stretch', margin: '4px 0' }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Yatay ayraç */}
      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '16px 0' }} />

      {/* Alt: TCMB metrikleri */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 48, flexWrap: 'wrap' }}>
        <TcmbMetrik etiket="TÜFE (Yıllık)"       deger={`%${tufe.toFixed(2)}`} />
        <TcmbMetrik etiket="Azami Kredi Faizi"    deger={`%${azami.toFixed(2)}`} alt="/ay" />
        <TcmbMetrik etiket="KFE (Konut)"          deger={`%${kfe.toFixed(2)}`} fallback={kfeFallback} />
      </div>

      <p style={{ margin: '12px 0 0', textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>
        Kaynak: TCMB EVDS API · Son güncelleme: {tarih}
      </p>
    </div>
  )
}

function TcmbMetrik({ etiket, deger, alt, fallback }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {etiket}
      </p>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-primary)' }}>
        {deger}
        {alt && <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 2 }}>{alt}</span>}
        {fallback && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 4 }}>(tahmini)</span>}
      </p>
    </div>
  )
}

function MetrikKart({ etiket, deger, renk }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <p className="text-tiny" style={{ margin: 0, marginBottom: 8 }}>{etiket}</p>
      <div className="heading-md" style={{ color: renk, fontWeight: 700 }}>{deger}</div>
    </div>
  )
}

function MalivetSatir({ etiket, deger, vurgu, kucuk }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <p style={{ margin: 0, fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500 }}>{etiket}</p>
      <p style={{
        margin: 0,
        fontSize: kucuk ? 12 : 14,
        fontWeight: vurgu ? 700 : 600,
        color: vurgu ? 'var(--color-negative)' : 'var(--text-primary)',
      }}>{deger}</p>
    </div>
  )
}

function MiniMetrik({ etiket, deger }) {
  return (
    <div>
      <p className="text-tiny" style={{ margin: 0, marginBottom: 4 }}>{etiket}</p>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{deger}</p>
    </div>
  )
}

function Th({ children, align = 'left' }) {
  return <th style={{ padding: '10px 12px', textAlign: align, fontSize: 12, fontWeight: 600,
    color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{children}</th>
}

function Td({ children, align = 'left', style }) {
  return <td style={{ padding: '12px', textAlign: align, color: 'var(--text-secondary)', ...style }}>{children}</td>
}

const sayfaStil = {
  minHeight: 'calc(100vh - 64px)',
  background: 'var(--bg-page)',
  padding: '32px 24px 100px',
}

const konteynerStil = {
  maxWidth: 960,
  margin: '0 auto',
}
