// KARAR: Modal'da body scroll lock + ESC dinleyici; query param ile gelen kategori otomatik açılır.
import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { getAnalysis } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import EmptyState from './EmptyState.jsx'

const RENKLER = [
  '#0F4C3A', '#167256', '#10B981', '#F59E0B',
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
  try {
    return new Date(tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
  } catch {
    return tarih
  }
}

export default function Expenses() {
  const navigate = useNavigate()
  const location = useLocation()
  const { kullanici } = useAuth()
  const userId = kullanici?.uid || localStorage.getItem('parapusula_user_id') || ''

  const [analiz, setAnaliz] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState('')
  const [secilen, setSecilen] = useState(null)

  useEffect(() => {
    if (!userId) return
    setYukleniyor(true)
    getAnalysis(userId)
      .then(setAnaliz)
      .catch(err => setHata(err.message?.includes('404') ? 'yok' : err.message))
      .finally(() => setYukleniyor(false))
  }, [userId])

  // Query param ile kategori açma
  useEffect(() => {
    if (!analiz) return
    const params = new URLSearchParams(location.search)
    const kat = params.get('kategori')
    if (kat) setSecilen(kat)
  }, [analiz, location.search])

  // ESC ile modal kapat + body scroll lock
  useEffect(() => {
    if (!secilen) return
    const handler = (e) => { if (e.key === 'Escape') setSecilen(null) }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [secilen])

  if (yukleniyor) {
    return (
      <div style={sayfaStil}>
        <div style={konteynerStil}>
          <div className="skeleton" style={{ height: 40, width: '40%', marginBottom: 24 }} />
          <div className="skeleton" style={{ height: 320, marginBottom: 24 }} />
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
            icon={<svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" /><path d="M7 15l4-4 4 4 5-6" />
            </svg>}
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
    .map((k, i) => ({
      ...k,
      renk: RENKLER[i % RENKLER.length],
      tutar: Math.abs(k.toplam_tutar),
    }))
    .sort((a, b) => b.tutar - a.tutar)

  const grafikVerisi = giderKategorileri.slice(0, 10).map(k => ({
    name: k.kategori_adi.length > 12 ? k.kategori_adi.slice(0, 12) + '...' : k.kategori_adi,
    tamIsim: k.kategori_adi,
    tutar: k.tutar,
    renk: k.renk,
  }))

  const secilenDetay = secilen ? giderKategorileri.find(k => k.kategori_adi === secilen) : null

  return (
    <div style={sayfaStil}>
      <div style={konteynerStil}>
        <div style={{ marginBottom: 32 }}>
          <h1 className="heading-lg">Harcamalarım</h1>
          <p className="text-body" style={{ marginTop: 4 }}>
            Kategoriye tıkla, işlemlerini incele.
          </p>
        </div>

        {/* Bar chart */}
        {grafikVerisi.length > 0 && (
          <div className="card" style={{ padding: 28, marginBottom: 24 }}>
            <h2 className="heading-sm" style={{ marginBottom: 20 }}>Kategoriye Göre Toplam</h2>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={grafikVerisi} margin={{ top: 5, right: 12, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                  angle={-30} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                  tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                  axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v, _, p) => [paraDuzenle(v), p.payload?.tamIsim || 'Tutar']}
                  contentStyle={{
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    boxShadow: 'var(--shadow-md)',
                  }}
                  cursor={{ fill: 'rgba(15,76,58,0.04)' }}
                />
                <Bar dataKey="tutar" radius={[8, 8, 0, 0]} cursor="pointer"
                  onClick={(d) => setSecilen(d.tamIsim)}>
                  {grafikVerisi.map((entry, i) => (
                    <Cell key={i} fill={entry.renk} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Kategori grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
        }}>
          {giderKategorileri.map((k, i) => (
            <button
              key={i}
              onClick={() => setSecilen(k.kategori_adi)}
              className="card card-interactive"
              style={{
                padding: 20, textAlign: 'left', cursor: 'pointer',
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                position: 'relative',
              }}
            >
              <div style={{
                width: 32, height: 4, borderRadius: 2,
                background: k.renk, marginBottom: 12,
              }} />
              <p style={{
                margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)',
                marginBottom: 6,
              }}>{k.kategori_adi}</p>
              <p className="heading-sm" style={{ color: 'var(--text-primary)', marginBottom: 8 }}>
                {paraDuzenle(k.tutar)}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="text-tiny" style={{ textTransform: 'none', letterSpacing: 0 }}>
                  {k.islem_sayisi} işlem
                </span>
                {k.abonelik_mi && (
                  <span className="badge" style={{
                    background: 'rgba(245,158,11,0.12)',
                    color: '#B45309',
                  }}>Abonelik</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Modal */}
      {secilenDetay && (
        <Modal kategori={secilenDetay} onClose={() => setSecilen(null)} />
      )}
    </div>
  )
}

function Modal({ kategori, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        animation: 'fadeIn 200ms ease both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass animate-fade-scale"
        style={{
          background: 'var(--bg-surface)',
          width: '100%', maxWidth: 720, maxHeight: '85vh',
          borderRadius: 'var(--radius-2xl)',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{
            width: 8, height: 40, borderRadius: 4, background: kategori.renk, flexShrink: 0,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
              {kategori.kategori_adi}
            </h2>
            <p className="text-small" style={{ margin: '2px 0 0' }}>
              {(kategori.islemler || []).length} işlem · Toplam {paraDuzenle(kategori.tutar)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: 8, borderRadius: '50%', minWidth: 36, minHeight: 36 }}
            aria-label="Kapat"
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '8px 24px 24px' }}>
          {(kategori.islemler || []).length === 0 ? (
            <p className="text-body" style={{ textAlign: 'center', padding: 32 }}>İşlem bulunamadı.</p>
          ) : (
            <div>
              {(kategori.islemler || []).map((islem, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '14px 0',
                  borderBottom: i < kategori.islemler.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                  <div style={{
                    width: 40, flexShrink: 0,
                    fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600,
                    textAlign: 'center',
                  }}>
                    {tarihDuzenle(islem.tarih)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {islem.aciklama}
                    </p>
                    {islem.banka && (
                      <p className="text-small" style={{ margin: '2px 0 0' }}>{islem.banka}</p>
                    )}
                  </div>
                  <div style={{
                    fontSize: 15, fontWeight: 600,
                    color: islem.tur === 'gelir' ? 'var(--color-positive)' : 'var(--color-negative)',
                    whiteSpace: 'nowrap',
                  }}>
                    {islem.tur === 'gelir' ? '+' : '−'}{paraDuzenle(islem.tutar)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
  maxWidth: 1100,
  margin: '0 auto',
}
