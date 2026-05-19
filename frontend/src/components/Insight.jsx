/**
 * ParaPusula — "Vay Be" Anı
 * Yeni PDF analizi sonrası gösterilen tam ekran insight ekranı.
 * Framer Motion ile animasyonlu; her satır sırayla gelir.
 */
import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { getInsight, markInsightGoruldu } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'

// ─── Yardımcı ─────────────────────────────────────────────────
const para = (n) =>
  new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.abs(n ?? 0))

// ─── Skor rengi ───────────────────────────────────────────────
function skorRenk(skor) {
  if (skor >= 65) return '#10B981'
  if (skor >= 50) return '#F59E0B'
  return '#EF4444'
}

// ─── Animasyon değişkenleri ───────────────────────────────────
const baslikVariant = {
  hidden:  { opacity: 0, y: -48 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
}

const gercekVariant = (i) => ({
  hidden:  { opacity: 0, x: -60 },
  visible: {
    opacity: 1, x: 0,
    transition: { duration: 0.4, delay: 0.3 * i, ease: 'easeOut' },
  },
})

const skorVariant = {
  hidden:  { opacity: 0, scale: 0.7 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, delay: 0.2, ease: 'backOut' } },
}

const butonVariant = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.3 } },
}

// ─── SVG Skor Göstergesi ──────────────────────────────────────
function SkorDaire({ skor, renk }) {
  const r     = 64
  const cevre = 2 * Math.PI * r
  const [offset, setOffset] = useState(cevre)

  useEffect(() => {
    // Animasyonlu doldurma — 0'dan skora
    const hedef = cevre * (1 - skor / 100)
    const sure  = 1000
    const baslangic = performance.now()

    const adim = (now) => {
      const gecen = Math.min((now - baslangic) / sure, 1)
      // easeInOut
      const t = gecen < 0.5 ? 2 * gecen * gecen : -1 + (4 - 2 * gecen) * gecen
      setOffset(cevre - (cevre - hedef) * t)
      if (gecen < 1) requestAnimationFrame(adim)
    }
    const id = setTimeout(() => requestAnimationFrame(adim), 400)
    return () => clearTimeout(id)
  }, [skor, cevre])

  return (
    <svg width={160} height={160} viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
      {/* Arka çember */}
      <circle cx={80} cy={80} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={12} />
      {/* Değer çemberi */}
      <circle
        cx={80} cy={80} r={r}
        fill="none"
        stroke={renk}
        strokeWidth={12}
        strokeLinecap="round"
        strokeDasharray={cevre}
        strokeDashoffset={offset}
        style={{ transition: 'none' }}
      />
      {/* Skor sayısı — normal yönde göster */}
      <text
        x={80} y={80}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          transform: 'rotate(90deg)', transformOrigin: '80px 80px',
          fontSize: 32, fontWeight: 800, fill: '#fff', fontFamily: 'inherit',
        }}
      >
        {skor}
      </text>
    </svg>
  )
}

// ─── Ana Bileşen ──────────────────────────────────────────────
export default function Insight() {
  const navigate = useNavigate()
  const { kullanici } = useAuth()
  const userId = kullanici?.uid || localStorage.getItem('parapusula_user_id') || ''

  const [data, setData]         = useState(null)
  const [yukleniyor, setYuk]    = useState(true)
  const [animBasladi, setAnim]  = useState(false)
  const [bitti, setBitti]       = useState(false)
  const kontrolRef              = useRef(false)

  useEffect(() => {
    if (!userId || kontrolRef.current) return
    kontrolRef.current = true

    getInsight(userId)
      .then((d) => {
        setData(d)
        // Zaten görüldüyse direkt dashboard'a yönlendir
        if (d.gosterildi_mi) {
          navigate('/dashboard', { replace: true })
          return
        }
        setYuk(false)
        // Küçük gecikme sonrası animasyonu başlat
        setTimeout(() => setAnim(true), 200)
      })
      .catch(() => navigate('/dashboard', { replace: true }))
  }, [userId])

  // Kullanıcı butona basınca
  async function handleAnladim() {
    setBitti(true)
    try { await markInsightGoruldu(userId) } catch (_) {}
    navigate('/dashboard', { replace: true })
  }

  if (yukleniyor || !data) {
    return (
      <div style={kaplanStil}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Hazırlanıyor...</div>
      </div>
    )
  }

  // ── Dinamik gerçekler listesi ──────────────────────────────
  const gercekler = []

  // En çarpıcı gerçeği üste al
  if (data.kredi_oran > 0) {
    gercekler.push(
      `💸 Paranın %${data.kredi_oran}'i kredi ödemelerine gitti.`
    )
  }

  if (data.en_yuksek_kategori) {
    gercekler.push(
      `🛒 ${data.en_yuksek_kategori.ad}'a ${para(data.en_yuksek_kategori.tutar)} TL harcadın.`
    )
  }

  if (data.abonelik_sayisi > 0) {
    gercekler.push(
      `📱 ${data.abonelik_sayisi} aboneliğe ayda ${para(data.abonelik_toplam)} TL ödüyorsun.`
    )
  }

  if (data.toplam_borc > 0) {
    const faizStr = data.aylik_faiz_tahmini > 0
      ? ` — aylık ~${para(data.aylik_faiz_tahmini)} TL faiz`
      : ''
    gercekler.push(
      `🏦 Toplam ${para(data.toplam_borc)} TL borcun var${faizStr}.`
    )
  }

  const renk = skorRenk(data.finansal_skor)

  return (
    <AnimatePresence>
      {!bitti && (
        <motion.div
          style={kaplanStil}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div style={icerikStil}>

            {/* ── Başlık ───────────────────────────────── */}
            <motion.div
              variants={baslikVariant}
              initial="hidden"
              animate={animBasladi ? 'visible' : 'hidden'}
              style={{ textAlign: 'center', marginBottom: 48 }}
            >
              {data.nakit_akisi_pozitif ? (
                <>
                  <div style={baslikStil('#10B981')}>
                    Bu ay <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {para(data.nakit_akisi)} TL
                    </span> fazla verdin. 💚
                  </div>
                  <p style={altyaziStil}>Bütçen kontrol altında — detayları görelim.</p>
                </>
              ) : (
                <>
                  <div style={baslikStil('#EF4444')}>
                    Bu ay <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {para(data.nakit_akisi)} TL
                    </span> açık verdin.
                  </div>
                  <p style={altyaziStil}>Neyin gittiğini öğrenmek için hazır mısın?</p>
                </>
              )}
            </motion.div>

            {/* ── Çarpıcı gerçekler ─────────────────────── */}
            <div style={{ marginBottom: 48, maxWidth: 480, width: '100%' }}>
              {gercekler.map((gercek, i) => (
                <motion.div
                  key={i}
                  variants={gercekVariant(i + 1)}
                  initial="hidden"
                  animate={animBasladi ? 'visible' : 'hidden'}
                  style={gercekStil}
                >
                  {gercek}
                </motion.div>
              ))}
            </div>

            {/* ── Finansal skor ─────────────────────────── */}
            <motion.div
              variants={skorVariant}
              initial="hidden"
              animate={animBasladi ? 'visible' : 'hidden'}
              style={{ textAlign: 'center', marginBottom: 48 }}
            >
              <SkorDaire skor={data.finansal_skor} renk={renk} />
              <p style={{ margin: '12px 0 0', fontSize: 16, color: renk, fontWeight: 700 }}>
                Finansal sağlığın <strong>{data.skor_etiketi}</strong> seviyede.
              </p>
            </motion.div>

            {/* ── Buton ────────────────────────────────── */}
            <motion.div
              variants={butonVariant}
              initial="hidden"
              animate={animBasladi ? 'visible' : 'hidden'}
            >
              <button
                onClick={handleAnladim}
                style={butonStil}
                onMouseEnter={e => { e.currentTarget.style.background = '#059669' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#10B981' }}
              >
                Detaylı Analizimi Gör →
              </button>
            </motion.div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Stiller ──────────────────────────────────────────────────
const kaplanStil = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'linear-gradient(135deg, #0F2027 0%, #203A43 50%, #2C5364 100%)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '24px',
  overflowY: 'auto',
}

const icerikStil = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  width: '100%', maxWidth: 540,
  paddingTop: 32, paddingBottom: 48,
}

const baslikStil = (renk) => ({
  fontSize: 'clamp(24px, 5vw, 36px)',
  fontWeight: 800,
  color: renk,
  lineHeight: 1.2,
  letterSpacing: '-0.02em',
  marginBottom: 12,
})

const altyaziStil = {
  fontSize: 16,
  color: 'rgba(255,255,255,0.55)',
  margin: 0,
}

const gercekStil = {
  fontSize: 'clamp(15px, 2.5vw, 18px)',
  color: 'rgba(255,255,255,0.92)',
  fontWeight: 500,
  lineHeight: 1.6,
  padding: '14px 20px',
  marginBottom: 12,
  background: 'rgba(255,255,255,0.05)',
  borderRadius: 12,
  borderLeft: '3px solid rgba(255,255,255,0.25)',
}

const butonStil = {
  background: '#10B981',
  color: '#fff',
  border: 'none',
  borderRadius: 16,
  padding: '18px 40px',
  fontSize: 17,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'background 0.2s',
  letterSpacing: '-0.01em',
  boxShadow: '0 0 32px rgba(16,185,129,0.35)',
}
