// KARAR: Dashboard başlığı; YZ önerileri accordion ile en alta taşındı;
//        aylık kıyaslama bölümü eklendi; upload kart veri yoksa hero, varsa mini.
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'
import { getAnalysis, recalculate, getComparison } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import EmptyState from './EmptyState.jsx'

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

const pctDuzenle = (pct) => {
  const abs = Math.abs(pct).toFixed(1)
  return `%${abs}`
}

const skorRengi = (s) => s >= 81 ? '#10B981' : s >= 61 ? '#F59E0B' : s >= 41 ? '#F97316' : '#EF4444'
const skorEtiketi = (s) => s >= 81 ? 'Mükemmel' : s >= 61 ? 'İyi' : s >= 41 ? 'Dikkat' : 'Kritik'
const skorBadgeClass = (s) => s >= 81 ? 'badge-positive' : s >= 61 ? 'badge-warning' : s >= 41 ? 'badge-warning' : 'badge-negative'

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

  const [analiz, setAnaliz]         = useState(null)
  const [karsilastirma, setKarsilastirma] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hesaplaniyor, setHesaplaniyor] = useState(false)

  useEffect(() => { analizGetir() }, [userId])

  const analizGetir = async () => {
    if (!userId) return
    setYukleniyor(true)
    try {
      const veri = await getAnalysis(userId)
      setAnaliz(veri)
      // Karşılaştırmayı arka planda yükle — hata olursa sessiz geç
      getComparison(userId)
        .then(k => setKarsilastirma(k))
        .catch(() => setKarsilastirma(null))
    } catch (err) {
      if (err.message?.includes('404')) setAnaliz(null)
      else addToast('Analiz yüklenemedi: ' + err.message, 'error')
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

  // Veri yoksa büyük upload hero göster
  if (!analiz) {
    return (
      <div style={sayfaStil}>
        <div style={konteynerStil}>
          <h1 className="heading-lg" style={{ marginBottom: 8 }}>Dashboard</h1>
          <p className="text-body" style={{ marginBottom: 32 }}>Finansal durumunuzu görmek için banka ekstreni yükleyin.</p>
          <UploadHeroKart navigate={navigate} buyuk />
        </div>
      </div>
    )
  }

  const skor      = analiz.finansal_skor || 0
  const gelir     = analiz.gelir || 0
  const gider     = analiz.toplam_gider || 0
  const nakitAkisi = analiz.nakit_akisi || 0
  const kategoriler = analiz.kategoriler || []
  const oneriler    = analiz.oneriler || []

  const grafikVerisi = kategoriler
    .filter(k => k.toplam_tutar < 0 && Math.abs(k.toplam_tutar) > 0)
    .map(k => ({ name: k.kategori_adi, value: Math.abs(k.toplam_tutar) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  const radialVerisi = [{ name: 'skor', value: skor, fill: skorRengi(skor) }]

  return (
    <div style={sayfaStil}>
      <div style={konteynerStil}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 16, marginBottom: 32,
        }}>
          <div>
            <h1 className="heading-lg">Dashboard</h1>
            <p className="text-body" style={{ marginTop: 4 }}>
              {analiz.ay || 'Bu ay'} dönemi · {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
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
            <button onClick={() => navigate('/upload')} className="btn btn-secondary" style={{ gap: 8 }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4M6 10l6-6 6 6" /><path d="M4 20h16" />
              </svg>
              Yeni Ekstre Yükle
            </button>
          </div>
        </div>

        {/* Hero — Finansal Skor */}
        <div className="card animate-fade-in" style={{ padding: 32, marginBottom: 24 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: 32, alignItems: 'center',
          }}>
            <div style={{ position: 'relative', width: 200, height: 200, flexShrink: 0 }}>
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
                <div className="heading-xl" style={{ color: skorRengi(skor), fontSize: 52 }}>{skor}</div>
                <span className={`badge ${skorBadgeClass(skor)}`} style={{ marginTop: 4 }}>
                  {skorEtiketi(skor)}
                </span>
              </div>
            </div>

            <div style={{ minWidth: 0 }}>
              <p className="text-tiny" style={{ color: 'var(--color-primary)', marginBottom: 4 }}>Finansal Sağlık</p>
              <h2 className="heading-md" style={{ marginBottom: 20 }}>Skorunu oluşturan 5 faktör</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
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
          <MetrikKart etiket="Bu Ay Gelir"  deger={paraDuzenle(gelir)}     renk="var(--color-positive)" yon="up" />
          <MetrikKart etiket="Bu Ay Gider"  deger={paraDuzenle(gider)}     renk="var(--color-negative)" yon="down" />
          <MetrikKart
            etiket="Nakit Akışı"
            deger={(nakitAkisi >= 0 ? '+' : '−') + paraDuzenle(nakitAkisi).replace('-', '')}
            renk={nakitAkisi >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'}
            yon={nakitAkisi >= 0 ? 'up' : 'down'}
            altMetin={nakitAkisi >= 0 ? 'Ay artıda kapanıyor' : 'Ay açıkta kapanıyor'}
          />
        </div>

        {/* Aylık kıyaslama — geçen ay verisi varsa göster */}
        {karsilastirma?.delta && <AylikKarsilastirma delta={karsilastirma.delta} oncekiAy={karsilastirma.onceki_ay} />}

        {/* Harcama dağılımı */}
        {grafikVerisi.length > 0 && (
          <div className="card" style={{ padding: 28, marginBottom: 24 }}>
            <h2 className="heading-sm" style={{ marginBottom: 20 }}>Harcama Dağılımı</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 24, alignItems: 'center' }}>
              <div style={{ height: 260, minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={grafikVerisi}
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={105}
                      dataKey="value" paddingAngle={2}
                    >
                      {grafikVerisi.map((_, i) => (
                        <Cell key={i} fill={PASTA_RENKLER[i % PASTA_RENKLER.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => [paraDuzenle(v), 'Tutar']}
                      contentStyle={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-md)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {grafikVerisi.map((k, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(`/expenses?kategori=${encodeURIComponent(k.name)}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '8px 10px', background: 'transparent', border: 'none',
                      cursor: 'pointer', borderRadius: 'var(--radius-md)', textAlign: 'left',
                      transition: 'background var(--transition-fast)', fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--border-subtle)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: PASTA_RENKLER[i % PASTA_RENKLER.length], flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{k.name}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{paraDuzenle(k.value)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Yapay Zeka Önerileri — en alta, accordion */}
        {oneriler.length > 0 && <YZOneriler oneriler={oneriler} />}
      </div>
    </div>
  )
}

// ─── Aylık Kıyaslama Bölümü ───────────────────────────────
function AylikKarsilastirma({ delta, oncekiAy }) {
  const { skor_bu, skor_once, skor_delta, gider_bu, gider_once, gider_pct,
          en_cok_artan, en_cok_azalan, borc_odenen, borc_pct } = delta

  const skorArtis = skor_delta >= 0

  return (
    <div className="card animate-fade-in" style={{ padding: 28, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <p className="text-tiny" style={{ color: 'var(--color-primary)', margin: 0 }}>GEÇEN AYA GÖRE</p>
        <span className="badge badge-neutral" style={{ fontSize: 10 }}>{oncekiAy}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {/* Skor değişimi */}
        <KarsilastirmaMetrik
          etiket="Finansal Skor"
          deger={`${skor_once} → ${skor_bu}`}
          fark={`${skor_delta >= 0 ? '↑' : '↓'} ${Math.abs(skor_delta)} puan`}
          iyi={skorArtis}
        />

        {/* Gider değişimi */}
        <KarsilastirmaMetrik
          etiket="Aylık Gider"
          deger={`${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(gider_once)} → ${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(gider_bu)} ₺`}
          fark={`${gider_pct >= 0 ? '▲' : '▼'} ${pctDuzenle(gider_pct)}`}
          iyi={gider_pct <= 0}
        />

        {/* En çok artan kategori */}
        {en_cok_artan && (
          <KarsilastirmaMetrik
            etiket="En Çok Artan"
            deger={en_cok_artan.kategori}
            fark={`▲ ${pctDuzenle(en_cok_artan.pct)}`}
            iyi={false}
          />
        )}

        {/* En çok azalan kategori */}
        {en_cok_azalan && en_cok_azalan.pct < 0 && (
          <KarsilastirmaMetrik
            etiket="En Çok Azalan"
            deger={en_cok_azalan.kategori}
            fark={`▼ ${pctDuzenle(Math.abs(en_cok_azalan.pct))}`}
            iyi
          />
        )}

        {/* Borç değişimi */}
        {borc_odenen > 0 && (
          <KarsilastirmaMetrik
            etiket="Borç Ödemesi"
            deger={`${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(borc_odenen)} ₺ ödendi`}
            fark={`▼ ${pctDuzenle(borc_pct)} azaldı`}
            iyi
          />
        )}
      </div>
    </div>
  )
}

function KarsilastirmaMetrik({ etiket, deger, fark, iyi }) {
  return (
    <div style={{
      padding: 16,
      background: iyi ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)',
      borderRadius: 'var(--radius-md)',
      border: `1px solid ${iyi ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'}`,
    }}>
      <p className="text-tiny" style={{ margin: '0 0 6px' }}>{etiket}</p>
      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{deger}</p>
      <p style={{
        margin: 0, fontSize: 13, fontWeight: 700,
        color: iyi ? 'var(--color-positive)' : 'var(--color-negative)',
      }}>{fark}</p>
    </div>
  )
}

// ─── Yapay Zeka Önerileri (Accordion) ─────────────────────
function YZOneriler({ oneriler }) {
  const [aciklar, setAciklar] = useState({})

  function toggle(id) {
    setAciklar(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Yeni format (id, ana_fikir, oncelik string, kazanim, maddeler)
  // + geriye uyumluluk: eski format (baslik, aciklama, oncelik number)
  const normalizeOneri = (o, i) => ({
    id:          o.id || `oneri_${i}`,
    ana_fikir:   o.ana_fikir || o.baslik || 'Öneri',
    oncelik:     typeof o.oncelik === 'string' ? o.oncelik : (o.oncelik === 1 ? 'Yüksek' : o.oncelik === 2 ? 'Orta' : 'Düşük'),
    kazanim:     o.kazanim || '',
    kazanim_tutari: o.kazanim_tutari || 0,
    maddeler:    o.maddeler || (o.aciklama ? [o.aciklama] : []),
  })

  const oncelikSirala = (a, b) => {
    const sira = { 'Yüksek': 0, 'Orta': 1, 'Düşük': 2 }
    return (sira[a.oncelik] ?? 1) - (sira[b.oncelik] ?? 1)
  }

  const siraliOneriler = oneriler.map(normalizeOneri).sort(oncelikSirala)

  const oncelikBadge = (o) => {
    if (o === 'Yüksek') return { cls: 'badge-negative', label: 'Yüksek Öncelik' }
    if (o === 'Orta')   return { cls: 'badge-warning',  label: 'Orta Öncelik' }
    return                     { cls: 'badge-positive', label: 'Düşük Öncelik' }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h2 className="heading-sm" style={{ marginBottom: 16 }}>Yapay Zeka Önerileri</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {siraliOneriler.map((o) => {
          const acik = !!aciklar[o.id]
          const badge = oncelikBadge(o.oncelik)
          return (
            <div key={o.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Kapalı header */}
              <button
                onClick={() => toggle(o.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                  padding: '20px 24px', background: 'transparent', border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}
              >
                <span className={`badge ${badge.cls}`} style={{ flexShrink: 0 }}>{badge.label}</span>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', minWidth: 0 }}>
                  {o.ana_fikir}
                </span>
                {o.kazanim && (
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--color-positive)',
                    background: 'rgba(16,185,129,0.08)', padding: '4px 10px',
                    borderRadius: 'var(--radius-full)', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {o.kazanim}
                  </span>
                )}
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ transform: acik ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform var(--transition-base)', flexShrink: 0 }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {/* Açık detay */}
              {acik && (
                <div className="animate-fade-in" style={{
                  padding: '0 24px 24px',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: 20,
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                    {o.maddeler.map((m, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <span style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: 'var(--color-primary-soft)', color: 'var(--color-primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1,
                        }}>{idx + 1}</span>
                        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{m}</p>
                      </div>
                    ))}
                  </div>

                  {o.kazanim && (
                    <div style={{
                      padding: '12px 16px', borderRadius: 'var(--radius-md)',
                      background: 'rgba(16,185,129,0.08)',
                      border: '1px solid rgba(16,185,129,0.2)',
                      marginBottom: 16,
                    }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-positive)' }}>
                        Bu öneriyi uygularsan: {o.kazanim}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => toggle(o.id)}
                    className="btn btn-secondary"
                    style={{ fontSize: 13 }}
                  >
                    Anladım, uygulayacağım
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Upload Kart ───────────────────────────────────────────
function UploadHeroKart({ navigate, buyuk }) {
  if (buyuk) {
    return (
      <div
        onClick={() => navigate('/upload')}
        className="card card-interactive animate-fade-in"
        style={{
          padding: 56, textAlign: 'center', cursor: 'pointer',
          border: '2px dashed var(--border-default)',
          background: 'rgba(15,76,58,0.02)',
          maxWidth: 560, margin: '0 auto',
        }}
      >
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'var(--color-primary-soft)', color: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V4M6 10l6-6 6 6" /><path d="M4 20h16" />
          </svg>
        </div>
        <h2 className="heading-md" style={{ marginBottom: 10 }}>Banka Ekstrenizi Yükleyin</h2>
        <p className="text-body" style={{ marginBottom: 0 }}>
          Ziraat veya Halkbank PDF ekstresi — AI saniyeler içinde haritanı çıkarsın.
        </p>
      </div>
    )
  }
  return null
}

// ─── Alt Bileşenler ────────────────────────────────────────
function MetrikKart({ etiket, deger, renk, yon, altMetin }) {
  return (
    <div className="card card-interactive" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <p className="text-tiny" style={{ margin: 0 }}>{etiket}</p>
        <div style={{
          width: 36, height: 36, borderRadius: 'var(--radius-md)',
          background: yon === 'up' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
          color: renk, display: 'flex', alignItems: 'center', justifyContent: 'center',
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
        <div className="skeleton" style={{ height: 260, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="skeleton" style={{ height: 110 }} />
          <div className="skeleton" style={{ height: 110 }} />
          <div className="skeleton" style={{ height: 110 }} />
        </div>
        <div className="skeleton" style={{ height: 300 }} />
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
