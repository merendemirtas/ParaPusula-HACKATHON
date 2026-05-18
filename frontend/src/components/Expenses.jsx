// KARAR: Modal'da body scroll lock + ESC dinleyici; trend okları önceki ay kıyaslamasından;
//        Abonelikler modalında 5-yıldız puanlama; Kredi/Borç Ödemesi'nde özel kredi kartı.
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { getAnalysis, getComparison, saveSubscriptionRating, getSubscriptionRatings } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
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
  const navigate  = useNavigate()
  const location  = useLocation()
  const { kullanici } = useAuth()
  const { addToast } = useToast()
  const userId = kullanici?.uid || localStorage.getItem('parapusula_user_id') || ''

  const [analiz,        setAnaliz]        = useState(null)
  const [katDelta,      setKatDelta]      = useState({}) // {kategori_adi: pct}
  const [abPuanlar,     setAbPuanlar]     = useState({}) // {adi_norm: {puan, tutar}}
  const [yukleniyor,    setYukleniyor]    = useState(true)
  const [hata,          setHata]          = useState('')
  const [secilen,       setSecilen]       = useState(null)

  useEffect(() => {
    if (!userId) return
    setYukleniyor(true)
    Promise.all([
      getAnalysis(userId),
      getComparison(userId).catch(() => null),
      getSubscriptionRatings(userId).catch(() => null),
    ]).then(([analiz, karsilastirma, puanlar]) => {
      setAnaliz(analiz)
      // Kategori delta haritası
      if (karsilastirma?.delta?.kat_degisimleri) {
        const dm = {}
        karsilastirma.delta.kat_degisimleri.forEach(d => {
          dm[d.kategori] = d.pct
        })
        setKatDelta(dm)
      }
      // Abonelik puanları
      if (puanlar?.puanlar) setAbPuanlar(puanlar.puanlar)
    }).catch(err => setHata(err.message?.includes('404') ? 'yok' : err.message))
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

  // Abonelik puan kaydetme (modal içinden callback)
  const abonelikPuanKaydet = useCallback(async (adi, puan, tutar) => {
    try {
      await saveSubscriptionRating(userId, adi, puan, tutar)
      // Yerel state'i güncelle
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
          <p className="text-body" style={{ marginTop: 4 }}>Kategoriye tıkla, işlemlerini incele.</p>
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
                  contentStyle={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-md)' }}
                  cursor={{ fill: 'rgba(15,76,58,0.04)' }}
                />
                <Bar dataKey="tutar" radius={[8, 8, 0, 0]} cursor="pointer" onClick={(d) => setSecilen(d.tamIsim)}>
                  {grafikVerisi.map((entry, i) => <Cell key={i} fill={entry.renk} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Kategori grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {giderKategorileri.map((k, i) => {
            const pct = katDelta[k.kategori_adi]
            const gosterTrend = pct !== undefined && Math.abs(pct) >= 5
            return (
              <button
                key={i}
                onClick={() => setSecilen(k.kategori_adi)}
                className="card card-interactive"
                style={{ padding: 20, textAlign: 'left', cursor: 'pointer', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', position: 'relative' }}
              >
                {/* Trend ok — sağ üst */}
                {gosterTrend && (
                  <div style={{
                    position: 'absolute', top: 12, right: 12,
                    fontSize: 12, fontWeight: 700,
                    color: pct > 0 ? 'var(--color-negative)' : 'var(--color-positive)',
                    background: pct > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
                    padding: '2px 8px', borderRadius: 'var(--radius-full)',
                  }}>
                    {pct > 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}%
                  </div>
                )}

                <div style={{ width: 32, height: 4, borderRadius: 2, background: k.renk, marginBottom: 12 }} />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {k.kategori_adi}
                </p>
                <p className="heading-sm" style={{ color: 'var(--text-primary)', marginBottom: 8 }}>
                  {paraDuzenle(k.tutar)}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="text-tiny" style={{ textTransform: 'none', letterSpacing: 0 }}>
                    {k.islem_sayisi} işlem
                  </span>
                  {k.abonelik_mi && (
                    <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#B45309' }}>Abonelik</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Modal */}
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

// ─── Modal ──────────────────────────────────────────────────
function Modal({ kategori, borcListesi, abPuanlar, onClose, onPuanKaydet, navigate }) {
  const isKredi    = kategori.kategori_adi.toLowerCase().includes('kredi') ||
                     kategori.kategori_adi.toLowerCase().includes('borç')
  const isAbonelik = kategori.abonelik_mi ||
                     kategori.kategori_adi.toLowerCase().includes('abonelik')

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, animation: 'fadeIn 200ms ease both',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="glass animate-fade-scale"
        style={{
          background: 'var(--bg-surface)',
          width: '100%', maxWidth: 720, maxHeight: '88vh',
          borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-xl)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 8, height: 40, borderRadius: 4, background: kategori.renk, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{kategori.kategori_adi}</h2>
            <p className="text-small" style={{ margin: '2px 0 0' }}>
              {(kategori.islemler || []).length} işlem · Toplam {paraDuzenle(kategori.tutar)}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: 8, borderRadius: '50%', minWidth: 36, minHeight: 36 }} aria-label="Kapat">
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '8px 24px 24px' }}>
          {(kategori.islemler || []).length === 0 ? (
            <p className="text-body" style={{ textAlign: 'center', padding: 32 }}>İşlem bulunamadı.</p>
          ) : isKredi ? (
            // Kredi/Borç Ödemesi: özel borç kartları
            <KrediIslemListesi islemler={kategori.islemler} borcListesi={borcListesi} navigate={navigate} />
          ) : isAbonelik ? (
            // Abonelikler: puanlama sistemi
            <AbonelikIslemListesi islemler={kategori.islemler} abPuanlar={abPuanlar} onPuanKaydet={onPuanKaydet} />
          ) : (
            // Normal işlem listesi
            <NormalIslemListesi islemler={kategori.islemler} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Normal İşlem Listesi ──────────────────────────────────
function NormalIslemListesi({ islemler }) {
  return (
    <div>
      {islemler.map((islem, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0',
          borderBottom: i < islemler.length - 1 ? '1px solid var(--border-subtle)' : 'none',
        }}>
          <div style={{ width: 40, flexShrink: 0, fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, textAlign: 'center' }}>
            {tarihDuzenle(islem.tarih)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {islem.aciklama}
            </p>
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

// ─── Kredi/Borç Ödemesi Listesi ────────────────────────────
function KrediIslemListesi({ islemler, borcListesi, navigate }) {
  const sinifRenk = {
    stratejik:     { renk: '#10B981', badgeCls: 'badge-positive' },
    yonetilebilir: { renk: '#F59E0B', badgeCls: 'badge-warning' },
    kritik:        { renk: '#EF4444', badgeCls: 'badge-negative' },
    gri:           { renk: '#F59E0B', badgeCls: 'badge-warning' },
    kotu:          { renk: '#EF4444', badgeCls: 'badge-negative' },
  }
  const sinifEtiket = {
    stratejik: 'Stratejik', yonetilebilir: 'Yönetilebilir', kritik: 'Kritik',
    gri: 'Yönetilebilir', kotu: 'Kritik',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 12 }}>
      {islemler.map((islem, i) => {
        // İşlem açıklamasıyla borc_listesi eşleştir (parçalı eşleşme)
        const eslesen = borcListesi.find(b =>
          b.aciklama?.toLowerCase().includes(islem.aciklama?.toLowerCase().slice(0, 8)) ||
          islem.aciklama?.toLowerCase().includes(b.aciklama?.toLowerCase().slice(0, 8))
        )

        if (eslesen) {
          const sinif = sinifRenk[eslesen.siniflandirma] || sinifRenk.yonetilebilir
          const etiket = sinifEtiket[eslesen.siniflandirma] || 'Yönetilebilir'
          return (
            <div key={i} style={{
              padding: 18, borderRadius: 'var(--radius-lg)',
              border: `1px solid ${sinif.renk}30`,
              background: `${sinif.renk}06`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {eslesen.aciklama}
                  </h4>
                  <span className={`badge ${sinif.badgeCls}`} style={{ marginTop: 4 }}>{etiket}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: sinif.renk }}>{paraDuzenle(eslesen.aylik_odeme)}</div>
                  <p className="text-small" style={{ margin: 0 }}>aylık ödeme</p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12 }}>
                <KrediMetrik etiket="Ana Para" deger={paraDuzenle(eslesen.ana_para)} />
                <KrediMetrik etiket="Faiz" deger={`%${eslesen.faiz_orani?.toFixed(2) || '0'} yıllık`} />
                <KrediMetrik etiket="Kalan Taksit" deger={`${eslesen.kalan_taksit} ay`} />
              </div>
              <button
                onClick={() => navigate('/debt')}
                style={{
                  marginTop: 12, fontSize: 13, color: 'var(--color-primary)', fontWeight: 600,
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                }}
              >
                Borç Haritasında Gör →
              </button>
            </div>
          )
        }

        // Eşleşme bulunamadıysa normal satır göster
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ width: 40, fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, textAlign: 'center' }}>{tarihDuzenle(islem.tarih)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{islem.aciklama}</p>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-negative)', whiteSpace: 'nowrap' }}>−{paraDuzenle(islem.tutar)}</div>
          </div>
        )
      })}
    </div>
  )
}

function KrediMetrik({ etiket, deger }) {
  return (
    <div>
      <p className="text-tiny" style={{ margin: '0 0 3px' }}>{etiket}</p>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{deger}</p>
    </div>
  )
}

// ─── Abonelik Puanlama Listesi ─────────────────────────────
function AbonelikIslemListesi({ islemler, abPuanlar, onPuanKaydet }) {
  const [kayitDurumu, setKayitDurumu] = useState({}) // {adi: 'kaydedildi'}

  async function puanSec(islem, puan) {
    const adi   = islem.aciklama
    const tutar = Math.abs(islem.tutar)
    setKayitDurumu(prev => ({ ...prev, [adi]: 'yukleniyor' }))
    await onPuanKaydet(adi, puan, tutar)
    setKayitDurumu(prev => ({ ...prev, [adi]: 'kaydedildi' }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {islemler.map((islem, i) => {
        const adi    = islem.aciklama
        const tutar  = Math.abs(islem.tutar)
        const docId  = adi.toLowerCase().replace(/ /g, '_').replace(/\//g, '_').slice(0, 64)
        const mevcutPuan = abPuanlar[docId]?.puan || 0
        const durum  = kayitDurumu[adi]
        return (
          <div key={i} style={{
            padding: '16px 0',
            borderBottom: i < islemler.length - 1 ? '1px solid var(--border-subtle)' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{adi}</p>
                <p className="text-small" style={{ margin: '2px 0 8px' }}>Aylık {paraDuzenle(tutar)}</p>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-tertiary)' }}>
                  Bu aboneliği ne kadar kullanıyorsun?
                </p>
                <YildizPuanlama
                  mevcutPuan={mevcutPuan}
                  onSec={(puan) => puanSec(islem, puan)}
                  disabled={durum === 'yukleniyor'}
                />
                {durum === 'kaydedildi' && (
                  <p className="animate-fade-in" style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-positive)', fontWeight: 600 }}>
                    Değerlendirmen kaydedildi ✓
                  </p>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', marginTop: 2 }}>
                {tarihDuzenle(islem.tarih)}
              </div>
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
      {[1, 2, 3, 4, 5].map(y => {
        const dolu = y <= (hover || mevcutPuan)
        return (
          <button
            key={y}
            onClick={() => !disabled && onSec(y)}
            onMouseEnter={() => setHover(y)}
            onMouseLeave={() => setHover(0)}
            style={{
              background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
              padding: 2, fontSize: 22, lineHeight: 1,
              color: dolu ? '#F59E0B' : 'var(--border-strong)',
              transition: 'color var(--transition-fast)',
              opacity: disabled ? 0.6 : 1,
            }}
            aria-label={`${y} yıldız`}
          >
            ★
          </button>
        )
      })}
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
