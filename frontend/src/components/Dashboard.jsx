// KARAR: Skor için RadialBarChart; 5 faktör mini-kart sabit-static (backend henüz vermiyorsa skor parçalı gösterim).
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'
import { getAnalysis, recalculate } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import EmptyState from './EmptyState.jsx'

// KARAR: Tek tonda olmayan, modern finansal pasta paleti — primary tonları + accent vurgusu.
const PASTA_RENKLER = [
  '#0F4C3A', '#167256', '#10B981', '#F59E0B',
  '#0F172A', '#475569', '#94A3B8', '#1E3A8A',
  '#7C3AED', '#EC4899', '#06B6D4', '#84CC16',
]

const paraDuzenle = (sayi) => {
  if (!sayi && sayi !== 0) return '0 ₺'
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(Math.abs(sayi)) + ' ₺'
}

const skorRengi = (s) => s >= 81 ? '#10B981' : s >= 61 ? '#F59E0B' : s >= 41 ? '#F97316' : '#EF4444'
const skorEtiketi = (s) => s >= 81 ? 'Mükemmel' : s >= 61 ? 'İyi' : s >= 41 ? 'Dikkat' : 'Kritik'
const skorBadgeClass = (s) => s >= 81 ? 'badge-positive' : s >= 61 ? 'badge-warning' : s >= 41 ? 'badge-warning' : 'badge-negative'

// KARAR: 5 faktör — skor 100 üzerinden bölündü, gerçek hesap backend yoksa görsel için sabit ağırlık.
const skorFaktorleri = (skor) => {
  const oran = skor / 100
  return [
    { ad: 'Nakit Akışı',  puan: Math.round(30 * oran), max: 30 },
    { ad: 'Borç / Gelir', puan: Math.round(25 * oran), max: 25 },
    { ad: 'Tasarruf',     puan: Math.round(20 * oran), max: 20 },
    { ad: 'Harcama Disiplini', puan: Math.round(15 * oran), max: 15 },
    { ad: 'Acil Fon',     puan: Math.round(10 * oran), max: 10 },
  ]
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { kullanici } = useAuth()
  const { addToast } = useToast()
  const userId = kullanici?.uid || localStorage.getItem('parapusula_user_id') || ''

  const [analiz, setAnaliz] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState('')
  const [hesaplaniyor, setHesaplaniyor] = useState(false)

  useEffect(() => { analizGetir() }, [userId])

  const analizGetir = async () => {
    if (!userId) return
    setYukleniyor(true); setHata('')
    try {
      const veri = await getAnalysis(userId)
      setAnaliz(veri)
    } catch (err) {
      if (err.message?.includes('404')) setHata('yok')
      else setHata(err.message || 'Analiz yüklenemedi.')
    } finally {
      setYukleniyor(false)
    }
  }

  const yenidenHesapla = async () => {
    if (!userId || hesaplaniyor) return
    setHesaplaniyor(true)
    try {
      await recalculate(userId)
      await analizGetir()
      addToast('Skorun yeniden hesaplandı.', 'success')
    } catch (err) {
      addToast('Hesaplama başarısız: ' + err.message, 'error')
    } finally {
      setHesaplaniyor(false)
    }
  }

  if (yukleniyor) return <DashboardSkeleton />

  if (hata === 'yok' || !analiz) {
    return (
      <div style={sayfaStil}>
        <div style={konteynerStil}>
          <EmptyState
            icon={
              <svg width={40} height={40} viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M16 6 L19 16 L16 26 L13 16 Z" fill="currentColor" />
                <circle cx="16" cy="16" r="2" fill="#fff" />
              </svg>
            }
            baslik="Henüz analiz yok"
            aciklama="Finansal panonu görmek için ilk banka ekstreni yükle. AI birkaç dakikada haritanı çıkarsın."
            action={
              <button onClick={() => navigate('/upload')} className="btn btn-primary btn-lg">
                PDF Yükle
              </button>
            }
          />
        </div>
      </div>
    )
  }

  const skor = analiz.finansal_skor || 0
  const gelir = analiz.gelir || 0
  const gider = analiz.toplam_gider || 0
  const nakitAkisi = analiz.nakit_akisi || 0
  const kategoriler = analiz.kategoriler || []
  const oneriler = analiz.oneriler || []

  const grafikVerisi = kategoriler
    .filter(k => k.toplam_tutar < 0 && Math.abs(k.toplam_tutar) > 0)
    .map(k => ({ name: k.kategori_adi, value: Math.abs(k.toplam_tutar) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  const radialVerisi = [{ name: 'skor', value: skor, fill: skorRengi(skor) }]

  return (
    <div style={sayfaStil}>
      <div style={konteynerStil}>
        {/* Page header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 16, marginBottom: 32,
        }}>
          <div>
            <h1 className="heading-lg">Finansal Panom</h1>
            <p className="text-body" style={{ marginTop: 4 }}>
              {analiz.ay || 'Bu ay'} dönemi · {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button
            onClick={yenidenHesapla}
            disabled={hesaplaniyor}
            className="btn btn-secondary"
          >
            {hesaplaniyor ? (
              <>
                <svg className="animate-spin" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 12a9 9 0 1 1-6.2-8.55" />
                </svg>
                Hesaplanıyor...
              </>
            ) : 'Yeniden Hesapla'}
          </button>
        </div>

        {/* Hero — Finansal Skor */}
        <div className="card animate-fade-in" style={{ padding: 32, marginBottom: 24 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: 32, alignItems: 'center',
          }}>
            {/* Radial chart */}
            <div style={{ position: 'relative', width: 220, height: 220, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="80%" outerRadius="100%"
                  data={radialVerisi}
                  startAngle={90} endAngle={-270}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                  <RadialBar background={{ fill: '#F1F5F9' }} dataKey="value" cornerRadius={20} angleAxisId={0} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <div className="heading-xl" style={{ color: skorRengi(skor), fontSize: 56 }}>{skor}</div>
                <span className={`badge ${skorBadgeClass(skor)}`} style={{ marginTop: 4 }}>
                  {skorEtiketi(skor)}
                </span>
              </div>
            </div>

            {/* Faktörler */}
            <div style={{ minWidth: 0 }}>
              <p className="text-tiny" style={{ color: 'var(--color-primary)', marginBottom: 4 }}>Finansal Sağlık</p>
              <h2 className="heading-md" style={{ marginBottom: 20 }}>
                Skorunu oluşturan 5 faktör
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                {skorFaktorleri(skor).map(f => (
                  <div key={f.ad} style={{
                    padding: 14,
                    background: 'rgba(15,76,58,0.03)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{f.ad}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: 'var(--color-primary)' }}>
                      +{f.puan}<span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>/{f.max}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 3 metrik kartı */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
          <MetrikKart
            etiket="Bu Ay Gelir" deger={paraDuzenle(gelir)}
            renk="var(--color-positive)" yon="up"
          />
          <MetrikKart
            etiket="Bu Ay Gider" deger={paraDuzenle(gider)}
            renk="var(--color-negative)" yon="down"
          />
          <MetrikKart
            etiket="Nakit Akışı"
            deger={(nakitAkisi >= 0 ? '+' : '−') + paraDuzenle(nakitAkisi).replace('-', '')}
            renk={nakitAkisi >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'}
            yon={nakitAkisi >= 0 ? 'up' : 'down'}
            altMetin={nakitAkisi >= 0 ? 'Ay artıda kapanıyor' : 'Ay açıkta kapanıyor'}
          />
        </div>

        {/* Aksiyon önerileri */}
        {oneriler.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 className="heading-sm" style={{ marginBottom: 16 }}>Aksiyon Önerileri</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {oneriler.slice(0, 3).map((o, i) => {
                const oncelikMap = {
                  1: { etiket: 'Yüksek', cls: 'badge-negative' },
                  2: { etiket: 'Orta',   cls: 'badge-warning' },
                  3: { etiket: 'Düşük',  cls: 'badge-positive' },
                }
                const onc = oncelikMap[o.oncelik] || { etiket: '—', cls: 'badge-neutral' }
                return (
                  <div key={i} className="card card-interactive" style={{ padding: 24, position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div className="heading-lg" style={{ color: 'var(--color-primary)', fontSize: 40, lineHeight: 1 }}>
                        {i + 1}
                      </div>
                      <span className={`badge ${onc.cls}`}>{onc.etiket}</span>
                    </div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {o.baslik}
                    </h3>
                    <p className="text-body" style={{ margin: 0, fontSize: 14 }}>
                      {o.aciklama}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Harcama dağılımı */}
        {grafikVerisi.length > 0 && (
          <div className="card" style={{ padding: 28 }}>
            <h2 className="heading-sm" style={{ marginBottom: 20 }}>Harcama Dağılımı</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 24, alignItems: 'center' }}>
              <div style={{ height: 280, minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={grafikVerisi}
                      cx="50%" cy="50%"
                      innerRadius={60} outerRadius={110}
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {grafikVerisi.map((_, i) => (
                        <Cell key={i} fill={PASTA_RENKLER[i % PASTA_RENKLER.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => [paraDuzenle(v), 'Tutar']}
                      contentStyle={{
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-default)',
                        boxShadow: 'var(--shadow-md)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {grafikVerisi.map((k, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(`/expenses?kategori=${encodeURIComponent(k.name)}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      borderRadius: 'var(--radius-md)', textAlign: 'left',
                      transition: 'background var(--transition-fast)',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border-subtle)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      width: 12, height: 12, borderRadius: 3,
                      background: PASTA_RENKLER[i % PASTA_RENKLER.length], flexShrink: 0,
                    }} />
                    <span style={{ flex: 1, fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                      {k.name}
                    </span>
                    <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {paraDuzenle(k.value)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <style>{`
              @media (max-width: 768px) {
                [data-pie-grid] { grid-template-columns: 1fr !important; }
              }
            `}</style>
          </div>
        )}
      </div>
    </div>
  )
}

function MetrikKart({ etiket, deger, renk, yon, altMetin }) {
  return (
    <div className="card card-interactive" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <p className="text-tiny" style={{ margin: 0 }}>{etiket}</p>
        <div style={{
          width: 36, height: 36, borderRadius: 'var(--radius-md)',
          background: renk === 'var(--color-positive)' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
          color: renk,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {yon === 'up'
              ? <><path d="M7 17l10-10" /><path d="M8 7h9v9" /></>
              : <><path d="M17 7L7 17" /><path d="M16 17H7V8" /></>
            }
          </svg>
        </div>
      </div>
      <div className="heading-md" style={{ color: renk, fontWeight: 700 }}>{deger}</div>
      {altMetin && <p className="text-small" style={{ margin: '6px 0 0' }}>{altMetin}</p>}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div style={sayfaStil}>
      <div style={konteynerStil}>
        <div className="skeleton" style={{ height: 40, width: '40%', marginBottom: 32 }} />
        <div className="skeleton" style={{ height: 280, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="skeleton" style={{ height: 120 }} />
          <div className="skeleton" style={{ height: 120 }} />
          <div className="skeleton" style={{ height: 120 }} />
        </div>
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    </div>
  )
}

const sayfaStil = {
  minHeight: 'calc(100vh - 64px)',
  background: 'var(--bg-page)',
  padding: '32px 24px 100px',
}

const konteynerStil = {
  maxWidth: 1200,
  margin: '0 auto',
}
