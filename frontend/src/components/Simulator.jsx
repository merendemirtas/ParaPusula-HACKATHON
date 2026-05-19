import React, { useState, useEffect, useRef } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { getAnalysis, simulatorBorcHizlandirma, simulatorBuyukKarar } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'

// ─── Yardımcı ─────────────────────────────────────────────────
const para = (n) =>
  new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.abs(n ?? 0)) + ' ₺'

const AYLAR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
function ayEtiketi(indexSifirTabanli) {
  const bugun = new Date()
  const toplamAy = bugun.getMonth() + indexSifirTabanli
  const yil = bugun.getFullYear() + Math.floor(toplamAy / 12)
  const ay  = ((toplamAy % 12) + 12) % 12
  return `${AYLAR[ay]} ${yil}`
}

const SINIF_BADGE = {
  stratejik:     { bg: 'var(--color-positive-light)', color: 'var(--color-primary-dark)', etiket: 'Stratejik' },
  yonetilebilir: { bg: 'var(--color-warning-light)',  color: 'var(--color-warning)',       etiket: 'Yönetilebilir' },
  kritik:        { bg: 'var(--color-negative-light)', color: 'var(--color-negative)',      etiket: 'Kritik' },
  gri:           { bg: 'var(--color-warning-light)',  color: 'var(--color-warning)',       etiket: 'Yönetilebilir' },
  kotu:          { bg: 'var(--color-negative-light)', color: 'var(--color-negative)',      etiket: 'Kritik' },
}

const SABLONLAR = [
  {
    ikon: '🚗',
    etiket: 'Arabamı satsam ne olur?',
    metin: 'Arabamı satsam ve bu parayla borcumu kapatsam finansal durumum nasıl değişir?',
  },
  {
    ikon: '💰',
    etiket: 'Maaşım artsa ne değişir?',
    metin: 'Maaşım artsa borçlarımı kaç ay önce kapatırım ve ne kadar birikim yapabilirim?',
  },
  {
    ikon: '✂️',
    etiket: 'Bir borcu kapatsam?',
    metin: 'En yüksek faizli borcumu tamamen kapatsam diğer borçlarıma ve nakit akışıma etkisi ne olur?',
  },
  {
    ikon: '📱',
    etiket: 'Aboneliklerimi iptal etsem?',
    metin: 'Tüm düşük puanlı aboneliklerimi iptal etsem yıllık ne kadar tasarruf ederim ve bu para nereye gidebilir?',
  },
]

// ─── Ana bileşen ───────────────────────────────────────────────
export default function Simulator() {
  const { kullanici } = useAuth()
  const userId = kullanici?.uid || localStorage.getItem('parapusula_user_id') || ''

  const [aktifTab, setAktifTab] = useState(0)

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', background: 'var(--bg-page)', padding: '32px 24px 100px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Başlık */}
        <div style={{ marginBottom: 28 }}>
          <h1 className="heading-lg">Senaryo Simülatörü</h1>
          <p className="text-body" style={{ marginTop: 4 }}>
            Finansal kararlarının geleceğini simüle et
          </p>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', borderBottom: '2px solid var(--border-subtle)',
          marginBottom: 32, gap: 0,
        }}>
          {['Borç Ödeme Hızlandırma', 'Büyük Karar Simülasyonu'].map((etiket, i) => (
            <button
              key={i}
              onClick={() => setAktifTab(i)}
              style={{
                padding: '12px 24px',
                background: 'transparent',
                border: 'none',
                borderBottom: aktifTab === i ? '2px solid var(--color-primary)' : '2px solid transparent',
                marginBottom: -2,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: aktifTab === i ? 600 : 400,
                color: aktifTab === i ? 'var(--color-primary)' : 'var(--text-tertiary)',
                transition: 'color 0.2s, border-color 0.2s',
                fontFamily: 'inherit',
              }}
            >
              {etiket}
            </button>
          ))}
        </div>

        {/* Tab içerikleri */}
        <div key={aktifTab} className="animate-fade-in">
          {aktifTab === 0
            ? <Tab1Hizlandirma userId={userId} />
            : <Tab2BuyukKarar userId={userId} />
          }
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// TAB 1 — Borç Ödeme Hızlandırma
// ═══════════════════════════════════════════════════════════════
function Tab1Hizlandirma({ userId }) {
  const [analiz, setAnaliz]         = useState(null)
  const [yukOk, setYukOk]           = useState(false)
  const [seciliIndex, setSeciliIdx] = useState(null)
  const [ekstra, setEkstra]         = useState(1000)
  const [sonuc, setSonuc]           = useState(null)
  const [hesaplaniyor, setHesap]    = useState(false)
  const [hata, setHata]             = useState('')
  const [tabloAcik, setTabloAcik]   = useState(false)
  const sonucRef = useRef(null)

  useEffect(() => {
    if (!userId) return
    getAnalysis(userId)
      .then(d => { setAnaliz(d); setYukOk(true) })
      .catch(() => setYukOk(true))
  }, [userId])

  const borcListesi = analiz?.borc_listesi || []
  const aylikGelir  = analiz?.gelir || 0
  const sliderMax   = Math.max(5000, Math.round(aylikGelir * 0.30 / 500) * 500)
  const secili      = seciliIndex !== null ? borcListesi[seciliIndex] : null

  async function hesapla() {
    if (!secili) return
    setHesap(true)
    setHata('')
    setSonuc(null)
    try {
      const resp = await simulatorBorcHizlandirma({
        ana_para:          secili.ana_para,
        aylik_odeme:       secili.aylik_odeme,
        faiz_orani_yillik: secili.faiz_orani,
        ekstra_odeme:      ekstra,
        borc_adi:          secili.aciklama,
      })
      setSonuc(resp)
      setTimeout(() => sonucRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (e) {
      setHata(e.message)
    } finally {
      setHesap(false)
    }
  }

  // Chart verisi: ay 0 = bugün (ana_para), sonraki aylar plan'dan
  const chartData = sonuc ? (() => {
    const maxLen = Math.max(sonuc.mevcut_plan.length, sonuc.hizli_plan.length)
    const data = [{ ay: 'Bugün', mevcut: secili.ana_para, hizli: secili.ana_para }]
    for (let i = 0; i < maxLen; i++) {
      data.push({
        ay:     ayEtiketi(i + 1),
        mevcut: sonuc.mevcut_plan[i] ?? 0,
        hizli:  sonuc.hizli_plan[i]  ?? 0,
      })
    }
    // Çok fazla nokta varsa her 3. ayı al
    return maxLen > 48 ? data.filter((_, i) => i % 3 === 0 || i === 0 || i === data.length - 1) : data
  })() : []

  if (!yukOk) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 100 }} />)}
      </div>
    )
  }

  if (!borcListesi.length) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ fontSize: 32, marginBottom: 12 }}>🏦</p>
        <h3 className="heading-sm" style={{ marginBottom: 8 }}>Borç verisi bulunamadı</h3>
        <p className="text-body">Simülatörü kullanmak için önce banka ekstrenizi yükleyin.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Girdi paneli */}
      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <h2 className="heading-sm" style={{ marginBottom: 20 }}>Borç Seçimi</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          {borcListesi.map((borc, i) => {
            const sinif = SINIF_BADGE[borc.siniflandirma] || SINIF_BADGE.yonetilebilir
            const secildi = seciliIndex === i
            return (
              <div
                key={i}
                onClick={() => setSeciliIdx(i)}
                style={{
                  border: `2px solid ${secildi ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                  borderRadius: 12, padding: '16px 20px', cursor: 'pointer',
                  background: secildi ? 'rgba(var(--color-primary-rgb, 34,197,94), 0.04)' : 'transparent',
                  transition: 'border-color 0.15s, background 0.15s',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{borc.aciklama}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: sinif.bg, color: sinif.color,
                    }}>{sinif.etiket}</span>
                  </div>
                  <span className="text-tiny">
                    Ana para: {para(borc.ana_para)} · Kalan taksit: {borc.kalan_taksit} ay
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-primary)' }}>
                    {para(borc.aylik_odeme)}
                  </div>
                  <span className="text-tiny">aylık</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Ekstra ödeme */}
        <h2 className="heading-sm" style={{ marginBottom: 16 }}>Ekstra Ödeme Tutarı</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
          <input
            type="number"
            value={ekstra}
            onChange={e => setEkstra(Math.max(0, Number(e.target.value)))}
            placeholder="Örn: 2.000"
            style={{
              flex: '0 0 160px', padding: '10px 14px', fontSize: 16, fontWeight: 600,
              border: '2px solid var(--border-default)', borderRadius: 10,
              background: 'var(--bg-surface)', color: 'var(--text-primary)',
              outline: 'none', fontFamily: 'inherit',
            }}
          />
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>TL / ay</span>
        </div>
        <input
          type="range"
          min={500}
          max={sliderMax}
          step={500}
          value={Math.min(ekstra, sliderMax)}
          onChange={e => setEkstra(Number(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--color-primary)', marginBottom: 6 }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="text-tiny">500 ₺</span>
          <span className="text-tiny">{para(sliderMax)} (gelirin %30'u)</span>
        </div>

        {/* Faiz bilinmiyorsa uyarı */}
        {secili && !secili.faiz_orani && (
          <div style={{
            marginTop: 16, padding: '14px 16px',
            background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.3)',
            borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          }}>
            <div>
              <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 13, color: 'var(--color-warning)' }}>
                ⚠ Bu borç için faiz oranı girilmemiş
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#B45309' }}>
                Hesaplama yapabilmek için önce faiz oranını girin.
              </p>
            </div>
            <a href="/debt" style={{ fontSize: 13, fontWeight: 600, color: '#D97706', whiteSpace: 'nowrap' }}>
              Borç Haritasına Git →
            </a>
          </div>
        )}

        {hata && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(239,68,68,.08)',
            border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, color: 'var(--color-negative)', fontSize: 14 }}>
            {hata}
          </div>
        )}

        <button
          onClick={hesapla}
          disabled={!secili || hesaplaniyor || !secili?.faiz_orani}
          className="btn btn-primary btn-lg"
          style={{ marginTop: 24, width: '100%', opacity: (!secili || hesaplaniyor || !secili?.faiz_orani) ? 0.6 : 1 }}
        >
          {hesaplaniyor ? 'Hesaplanıyor...' : 'Hesapla'}
        </button>
      </div>

      {/* Sonuç alanı */}
      {sonuc && (
        <div ref={sonucRef} className="animate-fade-in">
          {/* Line chart */}
          <div className="card" style={{ padding: 28, marginBottom: 20 }}>
            <h2 className="heading-sm" style={{ marginBottom: 20 }}>Borç Azalma Grafiği</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="ay"
                  tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                  interval="preserveStartEnd"
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={v => `${(v / 1000).toFixed(0)}K`}
                  tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip
                  formatter={(v, name) => [para(v), name === 'mevcut' ? 'Mevcut Plan' : 'Hızlandırılmış Plan']}
                  labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                  contentStyle={{ borderRadius: 10, border: '1px solid var(--border-subtle)', fontSize: 13 }}
                />
                <Legend
                  formatter={v => v === 'mevcut' ? 'Mevcut Plan' : 'Hızlandırılmış Plan'}
                  wrapperStyle={{ fontSize: 13 }}
                />
                <Line type="monotone" dataKey="mevcut" stroke="#E11D48" strokeWidth={2.5}
                  dot={false} name="mevcut" />
                <Line type="monotone" dataKey="hizli"  stroke="#0D9488" strokeWidth={2.5}
                  dot={false} name="hizli" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 3 metrik kart */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
            <SonucKart
              etiket="Erken Bitiş"
              deger={`${sonuc.ay_farki} ay önce`}
              renk="#0D9488"
              icon="⏱"
            />
            <SonucKart
              etiket="Faiz Tasarrufu"
              deger={para(sonuc.tasarruf)}
              renk="#0D9488"
              icon="💰"
            />
            <div className="card" style={{ padding: 20 }}>
              <p className="text-tiny" style={{ marginBottom: 8 }}>Toplam Ödeme Farkı</p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                Mevcut: <strong style={{ color: 'var(--color-negative)' }}>{para(sonuc.mevcut_toplam_odeme)}</strong>
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                Yeni: <strong style={{ color: 'var(--color-primary)' }}>{para(sonuc.hizli_toplam_odeme)}</strong>
              </p>
            </div>
          </div>

          {/* Ay-ay tablo */}
          <div className="card" style={{ padding: 28, marginBottom: 20 }}>
            <h2 className="heading-sm" style={{ marginBottom: 16 }}>Ay-ay Karşılaştırma</h2>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ background: 'var(--bg-surface)' }}>
                  <tr>
                    {['Ay', 'Mevcut Kalan', 'Hızlandırılmış Kalan', 'Fark'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Ay' ? 'left' : 'right',
                        fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
                        textTransform: 'uppercase', letterSpacing: '.04em',
                        borderBottom: '1px solid var(--border-default)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chartData.slice(1, tabloAcik ? undefined : 13).map((satir, i) => {
                    const hizliBitti = satir.hizli === 0 && satir.mevcut > 0
                    const fark = satir.mevcut - satir.hizli
                    return (
                      <tr key={i} style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: hizliBitti ? 'rgba(16,185,129,.04)' : 'transparent',
                      }}>
                        <td style={{ padding: '11px 14px', fontWeight: 500 }}>{satir.ay}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', color: 'var(--color-negative)', fontWeight: 500 }}>
                          {para(satir.mevcut)}
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'right',
                          color: hizliBitti ? 'var(--color-primary)' : 'var(--text-secondary)', fontWeight: hizliBitti ? 600 : 400 }}>
                          {satir.hizli === 0 ? '✓ Tamamlandı' : para(satir.hizli)}
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'right',
                          color: fark > 0 ? 'var(--color-primary)' : 'var(--text-tertiary)', fontWeight: 500 }}>
                          {fark > 0 ? `-${para(fark)}` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {chartData.length > 13 && (
              <button
                onClick={() => setTabloAcik(!tabloAcik)}
                className="btn btn-ghost"
                style={{ marginTop: 12, width: '100%' }}
              >
                {tabloAcik ? 'Daha Az Göster ▲' : `Tamamını Gör (${chartData.length - 1} ay) ▼`}
              </button>
            )}
          </div>

          {/* Gemini yorumu */}
          {sonuc.gemini_yorum && (
            <div style={{
              border: '1.5px solid #0D9488', borderRadius: 14,
              padding: '20px 24px', background: 'rgba(16,185,129,.06)',
            }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700,
                color: 'var(--color-primary)', letterSpacing: '.04em' }}>
                ✨ YZ YORUMU
              </p>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)' }}>
                {sonuc.gemini_yorum}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// TAB 2 — Büyük Karar Simülasyonu
// ═══════════════════════════════════════════════════════════════
function Tab2BuyukKarar({ userId }) {
  const [soru, setSoru]       = useState('')
  const [sonuc, setSonuc]     = useState(null)
  const [yukOk, setYukOk]     = useState(false)
  const [hata, setHata]       = useState('')
  const sonucRef = useRef(null)

  useEffect(() => { setYukOk(true) }, [])

  async function simuleEt() {
    if (!soru.trim()) return
    setYukOk(false)
    setHata('')
    setSonuc(null)
    try {
      const resp = await simulatorBuyukKarar({ user_id: userId, soru })
      setSonuc(resp)
      setTimeout(() => sonucRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (e) {
      setHata(e.message)
    } finally {
      setYukOk(true)
    }
  }

  return (
    <div>
      {/* Şablon butonları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        {SABLONLAR.map((s, i) => (
          <button
            key={i}
            onClick={() => setSoru(s.metin)}
            className="card card-interactive"
            style={{
              padding: '14px 16px', textAlign: 'left',
              background: soru === s.metin ? 'rgba(var(--color-primary-rgb,34,197,94),.06)' : undefined,
              border: soru === s.metin ? '1.5px solid var(--color-primary)' : undefined,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 20, display: 'block', marginBottom: 6 }}>{s.ikon}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.etiket}</span>
          </button>
        ))}
      </div>

      {/* Metin kutusu */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <textarea
          value={soru}
          onChange={e => setSoru(e.target.value)}
          rows={4}
          placeholder="Finansal kararınızı yazın... (Örn: 'Ev almayı düşünüyorum, şu an mantıklı mı?')"
          style={{
            width: '100%', padding: '12px 14px', fontSize: 14,
            border: '1.5px solid var(--border-default)', borderRadius: 10,
            background: 'var(--bg-page)', color: 'var(--text-primary)',
            resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6,
            outline: 'none', boxSizing: 'border-box',
          }}
        />
        {hata && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,.08)',
            border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, color: 'var(--color-negative)', fontSize: 13 }}>
            {hata}
          </div>
        )}
        <button
          onClick={simuleEt}
          disabled={!soru.trim() || !yukOk}
          className="btn btn-primary btn-lg"
          style={{ marginTop: 16, width: '100%', opacity: (!soru.trim() || !yukOk) ? 0.6 : 1 }}
        >
          {!yukOk ? <YukleniYorAnimasyonu /> : 'Simüle Et'}
        </button>
      </div>

      {/* Yükleniyor */}
      {!yukOk && (
        <div className="card animate-fade-in" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>🔮</div>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Finansal durumunuz analiz ediliyor<YukleniYorAnimasyonu /></p>
          <p className="text-body">Kararınızın etkisi hesaplanıyor, lütfen bekleyin...</p>
        </div>
      )}

      {/* Sonuç */}
      {sonuc && yukOk && (
        <div ref={sonucRef} className="animate-fade-in">
          {/* Finansal etki */}
          <div style={{
            border: '1.5px solid var(--color-primary)', borderRadius: 14,
            padding: '22px 26px', background: 'rgba(var(--color-primary-rgb,34,197,94),.04)',
            marginBottom: 20,
          }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700,
              color: 'var(--color-primary)', letterSpacing: '.04em' }}>
              💡 FİNANSAL ETKİ
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.7 }}>{sonuc.finansal_etki}</p>
            {sonuc.uyari && (
              <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,.1)',
                borderRadius: 8, borderLeft: '3px solid #F59E0B' }}>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-warning)' }}>
                  ⚠️ <strong>Dikkat:</strong> {sonuc.uyari}
                </p>
              </div>
            )}
          </div>

          {/* Sonraki adımlar */}
          {sonuc.adimlar?.length > 0 && (
            <div className="card" style={{ padding: 24, marginBottom: 20 }}>
              <h3 className="heading-sm" style={{ marginBottom: 14 }}>Sonraki 3 Adım</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sonuc.adimlar.map((adim, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--color-primary)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, marginTop: 1,
                    }}>{i + 1}</span>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{adim}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Karşılaştırma tablosu */}
          {sonuc.ozet_simdi && sonuc.ozet_sonra && (
            <div className="card" style={{ padding: 24 }}>
              <h3 className="heading-sm" style={{ marginBottom: 16 }}>Durum Karşılaştırması</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-default)' }}>
                      <th style={thStil}>Metrik</th>
                      <th style={{ ...thStil, textAlign: 'right', color: 'var(--text-secondary)' }}>Şu An</th>
                      <th style={{ ...thStil, textAlign: 'right', color: 'var(--color-primary)' }}>Yeni Senaryo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { etiket: 'Aylık Gelir',   simdi: sonuc.ozet_simdi.gelir,       sonra: sonuc.ozet_sonra.gelir,       yukari: true },
                      { etiket: 'Aylık Gider',   simdi: sonuc.ozet_simdi.gider,       sonra: sonuc.ozet_sonra.gider,       yukari: false },
                      { etiket: 'Nakit Akışı',   simdi: sonuc.ozet_simdi.nakit,       sonra: sonuc.ozet_sonra.nakit,       yukari: true },
                      { etiket: 'Toplam Borç',   simdi: sonuc.ozet_simdi.toplam_borc, sonra: sonuc.ozet_sonra.toplam_borc, yukari: false },
                    ].map(({ etiket, simdi, sonra, yukari }) => {
                      const degisti = sonra !== simdi
                      // iyi mi kötü mü: gelir/nakit arttıysa iyi, gider/borç azaldıysa iyi
                      const iyiMi = yukari ? sonra > simdi : sonra < simdi
                      return (
                        <tr key={etiket} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '13px 0', fontWeight: 500 }}>{etiket}</td>
                          <td style={{ padding: '13px 0', textAlign: 'right', color: 'var(--text-secondary)' }}>
                            {etiket === 'Nakit Akışı'
                              ? `${simdi >= 0 ? '+' : ''}${para(simdi)}`
                              : para(simdi)}
                          </td>
                          <td style={{ padding: '13px 0', textAlign: 'right',
                            color: degisti ? (iyiMi ? 'var(--color-primary)' : 'var(--color-negative)') : 'var(--text-secondary)',
                            fontWeight: degisti ? 600 : 400 }}>
                            {etiket === 'Nakit Akışı'
                              ? `${sonra >= 0 ? '+' : ''}${para(sonra)}`
                              : para(sonra)}
                            {degisti && <span style={{ marginLeft: 6, fontSize: 12 }}>{iyiMi ? '▲' : '▼'}</span>}
                          </td>
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
}

// ─── Küçük yardımcı bileşenler ────────────────────────────────
function SonucKart({ etiket, deger, renk, icon }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <p className="text-tiny" style={{ margin: '0 0 8px' }}>{icon} {etiket}</p>
      <div style={{ fontSize: 22, fontWeight: 700, color: renk }}>{deger}</div>
    </div>
  )
}

function YukleniYorAnimasyonu() {
  const [dots, setDots] = useState('')
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 450)
    return () => clearInterval(t)
  }, [])
  return <span>{dots}</span>
}

const thStil = {
  padding: '8px 0', textAlign: 'left', fontSize: 12,
  fontWeight: 600, color: 'var(--text-tertiary)',
  textTransform: 'uppercase', letterSpacing: '.04em',
}
