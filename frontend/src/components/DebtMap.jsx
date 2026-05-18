// KARAR: Borç çıkış planı accordion default açık (kullanıcı bilgiyi hemen görsün); auth uid kullanılıyor.
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAnalysis } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import EmptyState from './EmptyState.jsx'

const paraDuzenle = (sayi) => {
  if (!sayi && sayi !== 0) return '0 ₺'
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .format(Math.abs(sayi)) + ' ₺'
}

const SINIF = {
  stratejik:     { renk: 'var(--color-positive)', etiket: 'Stratejik',     aciklama: 'Değer yaratan borç — eviniz borçtan hızlı değerleniyor',
    badgeCls: 'badge-positive', barRenk: '#10B981' },
  yonetilebilir: { renk: 'var(--color-warning)',  etiket: 'Yönetilebilir', aciklama: 'Kontrol altında — ödeme planına devam et',
    badgeCls: 'badge-warning',  barRenk: '#F59E0B' },
  kritik:        { renk: 'var(--color-negative)', etiket: 'Kritik',        aciklama: 'Öncelikli öde — faiz birikimi hızlanıyor',
    badgeCls: 'badge-negative', barRenk: '#EF4444' },
  // Geriye uyumluluk: eski Firestore değerleri
  gri:  { renk: 'var(--color-warning)',  etiket: 'Yönetilebilir', aciklama: 'Kontrol altında — ödeme planına devam et',
    badgeCls: 'badge-warning',  barRenk: '#F59E0B' },
  kotu: { renk: 'var(--color-negative)', etiket: 'Kritik',        aciklama: 'Öncelikli öde — faiz birikimi hızlanıyor',
    badgeCls: 'badge-negative', barRenk: '#EF4444' },
}

export default function DebtMap() {
  const navigate = useNavigate()
  const { kullanici } = useAuth()
  const userId = kullanici?.uid || localStorage.getItem('parapusula_user_id') || ''

  const [analiz, setAnaliz] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState('')
  const [planAcik, setPlanAcik] = useState(true)

  useEffect(() => {
    if (!userId) return
    setYukleniyor(true)
    getAnalysis(userId)
      .then(setAnaliz)
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
                      <MiniMetrik etiket="Faiz" deger={`%${borc.faiz_orani?.toFixed(1) || '0'} yıllık`} />
                      <MiniMetrik etiket="Kalan Taksit" deger={`${borc.kalan_taksit} ay`} />
                    </div>

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
            {borcCikisPlan && (
              <div className="card" style={{ padding: 28 }}>
                <button
                  onClick={() => setPlanAcik(!planAcik)}
                  style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: 0, fontFamily: 'inherit', textAlign: 'left',
                  }}
                >
                  <div>
                    <p className="text-tiny" style={{ color: 'var(--color-primary)', marginBottom: 4 }}>STRATEJI</p>
                    <h2 className="heading-sm">Borç Çıkış Planı</h2>
                  </div>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ transform: planAcik ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform var(--transition-base)' }}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {planAcik && (
                  <div className="animate-fade-in" style={{ marginTop: 20 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                      <span className="badge badge-primary">
                        Yöntem: {borcCikisPlan.yontem === 'avalanche' ? 'Avalanche (Yüksek faizden)' : 'Snowball (Küçükten büyüğe)'}
                      </span>
                      <span className="badge badge-positive">
                        Tahmini bitiş: {borcCikisPlan.tahmini_bitis_ay}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                      <MiniMetrik etiket="Toplam Borç" deger={paraDuzenle(borcCikisPlan.toplam_borc)} />
                      <MiniMetrik etiket="Aylık Ekstra Ödeme" deger={paraDuzenle(borcCikisPlan.aylik_ekstra_odeme)} />
                    </div>

                    {borcCikisPlan.adimlar?.length > 0 && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                            Ay-Ay Ödeme Planı (Avalanche)
                          </h3>
                          <span className="text-tiny">{borcCikisPlan.adimlar.length} ay</span>
                        </div>
                        <div style={{
                          overflowX: 'auto',
                          maxHeight: 480,
                          overflowY: 'auto',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                        }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }}>
                              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                                <Th>Ay</Th>
                                <Th align="right">Ödeme Tutarı</Th>
                                <Th align="right">Kalan Borç</Th>
                                <Th>Bitecek Borç</Th>
                              </tr>
                            </thead>
                            <tbody>
                              {borcCikisPlan.adimlar.map((adim, i) => {
                                const bitiyor = !!adim.bitecek_borc
                                return (
                                  <tr key={i} style={{
                                    borderBottom: '1px solid var(--border-subtle)',
                                    background: bitiyor ? 'rgba(16, 185, 129, 0.04)' : 'transparent',
                                  }}>
                                    <Td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{adim.ay}</Td>
                                    <Td align="right" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                                      {paraDuzenle(adim.odeme_tutari)}
                                    </Td>
                                    <Td align="right" style={{
                                      color: adim.kalan_borc === 0 ? 'var(--color-positive)' : 'var(--text-secondary)',
                                      fontWeight: adim.kalan_borc === 0 ? 600 : 400,
                                    }}>
                                      {paraDuzenle(adim.kalan_borc)}
                                    </Td>
                                    <Td>
                                      {bitiyor ? (
                                        <span className="badge badge-positive" style={{ fontSize: 10 }}>
                                          ✓ {adim.bitecek_borc.length > 24
                                            ? adim.bitecek_borc.slice(0, 24) + '...'
                                            : adim.bitecek_borc}
                                        </span>
                                      ) : (
                                        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>—</span>
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
            )}
          </>
        )}
      </div>
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
