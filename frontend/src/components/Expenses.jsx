// KARAR: Pie+Bar swipeable chart; birikim kategorisi synthetic olarak eklendi;
//        trend okları önceki ay kıyaslamasından; kredi ve abonelik özel modalları korundu.
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts'
import {
  getAnalysis, getComparison, saveSubscriptionRating,
  getSubscriptionRatings, getGoals,
} from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import EmptyState from './EmptyState.jsx'

const RENKLER = [
  'var(--color-primary)', 'var(--color-primary-dark)', '#4A8C74', 'var(--color-warning)',
  '#7C3AED', '#EC4899', '#06B6D4', '#84CC16',
  '#0F172A', '#475569',
]

const paraDuzenle = (sayi) => {
  if (!sayi && sayi !== 0) return '0 ₺'
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .format(Math.abs(sayi)) + ' ₺'
}

const tarihDuzenle = (tarih) => {
  if (!tarih) return ''
  try { return new Date(tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }) }
  catch { return tarih }
}

export default function Expenses() {
  const navigate = useNavigate()
  const location = useLocation()
  const { kullanici } = useAuth()
  const { addToast } = useToast()
  const userId = kullanici?.uid || localStorage.getItem('parapusula_user_id') || ''

  const [analiz,    setAnaliz]    = useState(null)
  const [katDelta,  setKatDelta]  = useState({})
  const [abPuanlar, setAbPuanlar] = useState({})
  const [hedefler,  setHedefler]  = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata,      setHata]      = useState('')
  const [secilen,   setSecilen]   = useState(null)

  useEffect(() => {
    if (!userId) return
    setYukleniyor(true)
    Promise.all([
      getAnalysis(userId),
      getComparison(userId).catch(() => null),
      getSubscriptionRatings(userId).catch(() => null),
      getGoals(userId).catch(() => null),
    ]).then(([a, k, p, g]) => {
      setAnaliz(a)
      if (k?.delta?.kat_degisimleri) {
        const dm = {}
        k.delta.kat_degisimleri.forEach(d => { dm[d.kategori] = d.pct })
        setKatDelta(dm)
      }
      if (p?.puanlar) setAbPuanlar(p.puanlar)
      if (g?.hedefler) setHedefler(g.hedefler)
    }).catch(err => setHata(err.message?.includes('404') ? 'yok' : err.message))
      .finally(() => setYukleniyor(false))
  }, [userId])

  useEffect(() => {
    if (!analiz) return
    const params = new URLSearchParams(location.search)
    const kat = params.get('kategori')
    if (kat) setSecilen(kat)
  }, [analiz, location.search])

  useEffect(() => {
    if (!secilen) return
    const handler = (e) => { if (e.key === 'Escape') setSecilen(null) }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = '' }
  }, [secilen])

  const abonelikPuanKaydet = useCallback(async (adi, puan, tutar) => {
    try {
      await saveSubscriptionRating(userId, adi, puan, tutar)
      const docId = adi.toLowerCase().replace(/ /g, '_').replace(/\//g, '_').slice(0, 64)
      setAbPuanlar(prev => ({ ...prev, [docId]: { adi, puan, tutar } }))
      addToast('Değerlendirmen kaydedildi ✓', 'success')
    } catch (err) {
      addToast('Puan kaydedilemedi: ' + err.message, 'error')
    }
  }, [userId, addToast])

  if (yukleniyor) {
    return (
      <div style={sayfaStil}>
        <div style={konteynerStil}>
          <div className="skeleton" style={{ height: 40, width: '40%', marginBottom: 24 }} />
          <div className="skeleton" style={{ height: 360, marginBottom: 24 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {[...Array(8)].map((_, i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}
          </div>
        </div>
      </div>
    )
  }

  if (hata === 'yok' || !analiz) {
    return (
      <div style={sayfaStil}>
        <div style={konteynerStil}>
          <EmptyState
            icon={<svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 15l4-4 4 4 5-6" /></svg>}
            baslik="Harcama verisi yok"
            aciklama="Detaylı harcama analizini görmek için banka ekstreni yükle."
            action={<button onClick={() => navigate('/upload')} className="btn btn-primary btn-lg">PDF Yükle</button>}
          />
        </div>
      </div>
    )
  }

  const giderKategorileri = (analiz.kategoriler || [])
    .filter(k => k.toplam_tutar < 0)
    .map((k, i) => ({ ...k, renk: RENKLER[i % RENKLER.length], tutar: Math.abs(k.toplam_tutar) }))
    .sort((a, b) => b.tutar - a.tutar)

  // Birikim kategorisi synthetic olarak ekle
  const toplamBirikim = hedefler.reduce((s, h) => {
    const buAy = new Date().toISOString().slice(0, 7) // YYYY-MM
    const buAyBirikim = (h.birikimler || []).find(b => b.ay === buAy)
    return s + (buAyBirikim?.tutar || 0)
  }, 0)
  const birikimKategori = toplamBirikim > 0 ? {
    kategori_adi: 'Birikim',
    tutar: toplamBirikim,
    islem_sayisi: hedefler.length,
    abonelik_mi: false,
    renk: 'var(--color-positive)',
    isBirikim: true,
    islemler: hedefler.map(h => {
      const buAy = new Date().toISOString().slice(0, 7)
      const b = (h.birikimler || []).find(x => x.ay === buAy)
      return { aciklama: h.ad, tutar: b?.tutar || 0, tarih: buAy, tur: 'birikim' }
    }).filter(x => x.tutar > 0),
  } : null

  const tumKategoriler = birikimKategori
    ? [birikimKategori, ...giderKategorileri]
    : giderKategorileri

  const secilenDetay = secilen ? tumKategoriler.find(k => k.kategori_adi === secilen) : null

  return (
    <div style={sayfaStil}>
      <div style={konteynerStil}>
        <div style={{ marginBottom: 32 }}>
          <h1 className="heading-lg">Harcamalarım</h1>
          <p className="text-body" style={{ marginTop: 4 }}>Kategoriye tıkla, işlemlerini incele.</p>
        </div>

        {/* Swipeable Chart */}
        <SwipeableChart
          giderKategorileri={giderKategorileri}
          onKategoriSec={setSecilen}
        />

        {/* Kategori Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {tumKategoriler.map((k, i) => {
            const pct        = katDelta[k.kategori_adi]
            const gosterTrend = pct !== undefined && Math.abs(pct) >= 5 && !k.isBirikim

            return (
              <button
                key={i}
                onClick={() => setSecilen(k.kategori_adi)}
                className="card card-interactive"
                style={{ padding: 20, textAlign: 'left', cursor: 'pointer', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', position: 'relative' }}
              >
                {gosterTrend && (
                  <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 12, fontWeight: 700, color: pct > 0 ? 'var(--color-negative)' : 'var(--color-primary)', background: pct > 0 ? 'var(--color-negative-light)' : 'var(--color-positive-light)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                    {pct > 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}%
                  </div>
                )}
                <div style={{ width: 32, height: 4, borderRadius: 2, background: k.renk, marginBottom: 12 }} />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>{k.kategori_adi}</p>
                <p className="heading-sm" style={{ color: 'var(--text-primary)', marginBottom: 8 }}>{paraDuzenle(k.tutar)}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="text-tiny" style={{ textTransform: 'none', letterSpacing: 0 }}>{k.islem_sayisi} {k.isBirikim ? 'hedef' : 'işlem'}</span>
                  {k.abonelik_mi && <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#B45309' }}>Abonelik</span>}
                  {k.isBirikim  && <span className="badge badge-positive">Birikim</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {secilenDetay && (
        <Modal
          kategori={secilenDetay}
          borcListesi={analiz.borc_listesi || []}
          abPuanlar={abPuanlar}
          onClose={() => setSecilen(null)}
          onPuanKaydet={abonelikPuanKaydet}
          navigate={navigate}
        />
      )}
    </div>
  )
}

// ─── Swipeable Chart (Pie ↔ Bar) ──────────────────────────
function SwipeableChart({ giderKategorileri, onKategoriSec }) {
  const [aktif, setAktif]         = useState(0)  // 0=pie, 1=bar
  const [hint, setHint]           = useState(true)
  const [dragStart, setDragStart] = useState(null)
  const [highlighted, setHighlighted] = useState(null)

  // İlk 2 saniye hint göster, sonra gizle
  useEffect(() => {
    const t = setTimeout(() => setHint(false), 2000)
    return () => clearTimeout(t)
  }, [])

  function handleDragStart(x) { setDragStart(x) }
  function handleDragEnd(x) {
    if (dragStart === null) return
    const delta = x - dragStart
    if (Math.abs(delta) > 50) setAktif(delta < 0 ? 1 : 0)
    setDragStart(null)
  }

  const toplam = giderKategorileri.reduce((s, k) => s + k.tutar, 0)

  const grafikVerisi = giderKategorileri.slice(0, 10).map(k => ({
    name:    k.kategori_adi.length > 12 ? k.kategori_adi.slice(0, 12) + '...' : k.kategori_adi,
    tamIsim: k.kategori_adi, tutar: k.tutar, renk: k.renk,
  }))

  const CustomTooltipBar = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--bg-surface)', padding: '8px 12px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-default)' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{payload[0]?.payload?.tamIsim}</p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-negative)', fontWeight: 600 }}>{paraDuzenle(payload[0]?.value)}</p>
      </div>
    )
  }

  const CustomTooltipPie = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const pct = ((payload[0].value / toplam) * 100).toFixed(1)
    return (
      <div style={{ background: 'var(--bg-surface)', padding: '8px 12px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-default)' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{payload[0].name}</p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{paraDuzenle(payload[0].value)} · %{pct}</p>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 28, marginBottom: 24, userSelect: 'none' }}
      onMouseDown={e => handleDragStart(e.clientX)}
      onMouseUp={e => handleDragEnd(e.clientX)}
      onTouchStart={e => handleDragStart(e.touches[0].clientX)}
      onTouchEnd={e => handleDragEnd(e.changedTouches[0].clientX)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div>
          <h2 className="heading-sm" style={{ margin: 0 }}>
            {aktif === 0 ? 'Harcama Dağılımı' : 'Kategoriye Göre Toplam'}
          </h2>
          <p className="text-small" style={{ margin: '4px 0 0' }}>
            {aktif === 0 ? 'Toplam: ' + paraDuzenle(toplam) : 'En yüksekten en düşüğe'}
          </p>
        </div>
        {hint && (
          <span className="animate-fade-in text-tiny" style={{ color: 'var(--text-tertiary)', textTransform: 'none', letterSpacing: 0 }}>
            ← Kaydır →
          </span>
        )}
      </div>

      {/* Grafik alanı */}
      <div style={{ height: 300, marginTop: 16 }}>
        {aktif === 0 ? (
          // ── Pie Chart ──────────────────────────────────────
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, height: '100%', alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={giderKategorileri.slice(0, 8)}
                  dataKey="tutar"
                  nameKey="kategori_adi"
                  cx="50%" cy="50%"
                  innerRadius={65} outerRadius={110}
                  paddingAngle={2}
                  onClick={d => { onKategoriSec(d.kategori_adi); setHighlighted(d.kategori_adi) }}
                >
                  {giderKategorileri.slice(0, 8).map((k, i) => (
                    <Cell key={i} fill={k.renk}
                      opacity={highlighted && highlighted !== k.kategori_adi ? 0.4 : 1}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </Pie>
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
                  style={{ fontSize: 13, fontWeight: 700, fill: 'var(--text-primary)' }}>
                  {paraDuzenle(toplam)}
                </text>
                <Tooltip content={<CustomTooltipPie />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
              {giderKategorileri.slice(0, 8).map((k, i) => {
                const pct = ((k.tutar / toplam) * 100).toFixed(1)
                return (
                  <button key={i} onClick={() => onKategoriSec(k.kategori_adi)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: 'var(--radius-md)', textAlign: 'left', fontFamily: 'inherit', transition: 'background var(--transition-fast)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--border-subtle)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: k.renk, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.kategori_adi}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{paraDuzenle(k.tutar)}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 2 }}>%{pct}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          // ── Bar Chart ──────────────────────────────────────
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={grafikVerisi} margin={{ top: 5, right: 12, left: 0, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} angle={-30} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltipBar />} cursor={{ fill: 'rgba(15,76,58,0.04)' }} />
              <Bar dataKey="tutar" radius={[8, 8, 0, 0]} cursor="pointer" onClick={d => onKategoriSec(d.tamIsim)}>
                {grafikVerisi.map((e, i) => <Cell key={i} fill={e.renk} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Geçiş göstergesi */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
        {[0, 1].map(i => (
          <button key={i} onClick={() => setAktif(i)}
            style={{ width: 8, height: 8, borderRadius: '50%', background: aktif === i ? 'var(--color-primary)' : 'var(--border-strong)', border: 'none', cursor: 'pointer', padding: 0, transition: 'background var(--transition-fast)' }}
            aria-label={i === 0 ? 'Pie chart' : 'Bar chart'}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────
function Modal({ kategori, borcListesi, abPuanlar, onClose, onPuanKaydet, navigate }) {
  const isKredi    = kategori.kategori_adi.toLowerCase().includes('kredi') || kategori.kategori_adi.toLowerCase().includes('borç')
  const isAbonelik = kategori.abonelik_mi || kategori.kategori_adi.toLowerCase().includes('abonelik')
  const isBirikim  = !!kategori.isBirikim

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, animation: 'fadeIn 200ms ease both' }}>
      <div onClick={e => e.stopPropagation()} className="glass animate-fade-scale"
        style={{ background: 'var(--bg-surface)', width: '100%', maxWidth: 720, maxHeight: '88vh', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-xl)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 8, height: 40, borderRadius: 4, background: kategori.renk, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{kategori.kategori_adi}</h2>
            <p className="text-small" style={{ margin: '2px 0 0' }}>
              {(kategori.islemler || []).length} {isBirikim ? 'hedef' : 'işlem'} · Toplam {paraDuzenle(kategori.tutar)}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: 8, borderRadius: '50%' }} aria-label="Kapat">
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M6 18L18 6" /></svg>
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '8px 24px 24px' }}>
          {(kategori.islemler || []).length === 0 ? (
            <p className="text-body" style={{ textAlign: 'center', padding: 32 }}>İşlem bulunamadı.</p>
          ) : isBirikim ? (
            <BirikimIslemListesi islemler={kategori.islemler} />
          ) : isKredi ? (
            <KrediIslemListesi islemler={kategori.islemler} borcListesi={borcListesi} navigate={navigate} />
          ) : isAbonelik ? (
            <AbonelikIslemListesi islemler={kategori.islemler} abPuanlar={abPuanlar} onPuanKaydet={onPuanKaydet} />
          ) : (
            <NormalIslemListesi islemler={kategori.islemler} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Birikim İşlem Listesi ────────────────────────────────
function BirikimIslemListesi({ islemler }) {
  return (
    <div style={{ paddingTop: 12 }}>
      {islemler.map((item, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: i < islemler.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>🎯</span>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{item.aciklama}</p>
          </div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-positive)' }}>+{paraDuzenle(item.tutar)}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Normal, Kredi, Abonelik listeleri ───────────────────
function NormalIslemListesi({ islemler }) {
  return (
    <div>
      {islemler.map((islem, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: i < islemler.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
          <div style={{ width: 40, flexShrink: 0, fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, textAlign: 'center' }}>{tarihDuzenle(islem.tarih)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{islem.aciklama}</p>
            {islem.banka && <p className="text-small" style={{ margin: '2px 0 0' }}>{islem.banka}</p>}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: islem.tur === 'gelir' ? 'var(--color-positive)' : 'var(--color-negative)', whiteSpace: 'nowrap' }}>
            {islem.tur === 'gelir' ? '+' : '−'}{paraDuzenle(islem.tutar)}
          </div>
        </div>
      ))}
    </div>
  )
}

function KrediIslemListesi({ islemler, borcListesi, navigate }) {
  const sinifRenk = { stratejik: 'var(--color-positive)', yonetilebilir: 'var(--color-warning)', kritik: 'var(--color-negative)', gri: 'var(--color-warning)', kotu: 'var(--color-negative)' }
  const sinifBadge = { stratejik: 'badge-positive', yonetilebilir: 'badge-warning', kritik: 'badge-negative', gri: 'badge-warning', kotu: 'badge-negative' }
  const sinifEtiket = { stratejik: 'Stratejik', yonetilebilir: 'Yönetilebilir', kritik: 'Kritik', gri: 'Yönetilebilir', kotu: 'Kritik' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 12 }}>
      {islemler.map((islem, i) => {
        const eslesen = borcListesi.find(b =>
          b.aciklama?.toLowerCase().includes(islem.aciklama?.toLowerCase().slice(0, 8)) ||
          islem.aciklama?.toLowerCase().includes(b.aciklama?.toLowerCase().slice(0, 8))
        )
        if (eslesen) {
          const renk = sinifRenk[eslesen.siniflandirma] || 'var(--color-warning)'
          return (
            <div key={i} style={{ padding: 18, borderRadius: 'var(--radius-lg)', border: `1px solid ${renk}30`, background: `${renk}06` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{eslesen.aciklama}</h4>
                  <span className={`badge ${sinifBadge[eslesen.siniflandirma] || 'badge-warning'}`} style={{ marginTop: 4 }}>
                    {sinifEtiket[eslesen.siniflandirma] || 'Yönetilebilir'}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: renk }}>{paraDuzenle(eslesen.aylik_odeme)}</div>
                  <p className="text-small" style={{ margin: 0 }}>aylık</p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12, marginBottom: 12 }}>
                {[['Ana Para', paraDuzenle(eslesen.ana_para)], [`%${eslesen.faiz_orani?.toFixed(2) || '0'} yıllık`, 'Faiz'], [`${eslesen.kalan_taksit} ay`, 'Kalan']].map(([d, e]) => (
                  <div key={e}>
                    <p className="text-tiny" style={{ margin: '0 0 2px' }}>{e}</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{d}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => navigate('/debt')} style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                Borç Haritasında Gör →
              </button>
            </div>
          )
        }
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ width: 40, fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, textAlign: 'center' }}>{tarihDuzenle(islem.tarih)}</div>
            <div style={{ flex: 1, minWidth: 0 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{islem.aciklama}</p></div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-negative)', whiteSpace: 'nowrap' }}>−{paraDuzenle(islem.tutar)}</div>
          </div>
        )
      })}
    </div>
  )
}

function AbonelikIslemListesi({ islemler, abPuanlar, onPuanKaydet }) {
  const [kayitDurumu, setKayit] = useState({})

  async function puanSec(islem, puan) {
    setKayit(prev => ({ ...prev, [islem.aciklama]: 'yukleniyor' }))
    await onPuanKaydet(islem.aciklama, puan, Math.abs(islem.tutar))
    setKayit(prev => ({ ...prev, [islem.aciklama]: 'kaydedildi' }))
  }

  return (
    <div>
      {islemler.map((islem, i) => {
        const adi   = islem.aciklama
        const docId = adi.toLowerCase().replace(/ /g, '_').replace(/\//g, '_').slice(0, 64)
        const mevcut = abPuanlar[docId]?.puan || 0
        const durum  = kayitDurumu[adi]
        return (
          <div key={i} style={{ padding: '16px 0', borderBottom: i < islemler.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{adi}</p>
                <p className="text-small" style={{ margin: '2px 0 8px' }}>Aylık {paraDuzenle(Math.abs(islem.tutar))}</p>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-tertiary)' }}>Bu aboneliği ne kadar kullanıyorsun?</p>
                <YildizPuanlama mevcutPuan={mevcut} onSec={(p) => puanSec(islem, p)} disabled={durum === 'yukleniyor'} />
                {durum === 'kaydedildi' && (
                  <p className="animate-fade-in" style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-positive)', fontWeight: 600 }}>Değerlendirmen kaydedildi ✓</p>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', marginTop: 2 }}>{tarihDuzenle(islem.tarih)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function YildizPuanlama({ mevcutPuan, onSec, disabled }) {
  const [hover, setHover] = useState(0)
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(y => (
        <button key={y} onClick={() => !disabled && onSec(y)}
          onMouseEnter={() => setHover(y)} onMouseLeave={() => setHover(0)}
          style={{ background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', padding: 2, fontSize: 22, lineHeight: 1, color: y <= (hover || mevcutPuan) ? 'var(--color-warning)' : 'var(--border-strong)', transition: 'color var(--transition-fast)', opacity: disabled ? 0.6 : 1 }}
          aria-label={`${y} yıldız`}>★</button>
      ))}
    </div>
  )
}

const sayfaStil    = { minHeight: 'calc(100vh - 64px)', background: 'var(--bg-page)', padding: '32px 24px 100px' }
const konteynerStil = { maxWidth: 1100, margin: '0 auto' }
