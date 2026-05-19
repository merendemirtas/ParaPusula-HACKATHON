// KARAR: Sol panel sadece >=900px'de görünür; ikonlar inline SVG ile minimum.
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase.js'
import { getHealthScore } from '../services/api.js'
import { useToast } from '../context/ToastContext.jsx'

export default function Login() {
  const [form, setForm] = useState({ email: '', sifre: '' })
  const [hata, setHata] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const navigate = useNavigate()
  const { addToast } = useToast()

  function handleDegisim(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setHata('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setYukleniyor(true)
    setHata('')

    try {
      const sonuc = await signInWithEmailAndPassword(auth, form.email, form.sifre)
      const uid = sonuc.user.uid
      addToast('Hoş geldin! Verilerin hazırlanıyor.', 'success')

      try {
        await getHealthScore(uid)
        navigate('/dashboard', { replace: true })
      } catch {
        navigate('/onboarding', { replace: true })
      }
    } catch (err) {
      setHata(hataMetniCevir(err.code))
    } finally {
      setYukleniyor(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
      background: 'var(--bg-page)',
    }}>
      {/* Sol panel — sadece desktop */}
      <SolPanel />

      {/* Sağ form */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
        <div className="animate-fade-in" style={{ width: '100%', maxWidth: 420 }}>
          <h1 className="heading-lg" style={{ marginBottom: 8 }}>Tekrar hoş geldin</h1>
          <p className="text-body" style={{ marginBottom: 32 }}>
            Finansal pusulan seni bekliyor.
          </p>

          {hata && (
            <div className="animate-fade-in" style={{
              marginBottom: 16,
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#B91C1C',
              fontSize: 14,
              fontWeight: 500,
            }}>
              {hata}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label className="label" htmlFor="email">E-posta</label>
              <input
                id="email"
                name="email"
                type="email"
                className="input"
                value={form.email}
                onChange={handleDegisim}
                placeholder="ornek@email.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label" htmlFor="sifre">Şifre</label>
              <input
                id="sifre"
                name="sifre"
                type="password"
                className="input"
                value={form.sifre}
                onChange={handleDegisim}
                placeholder="Şifrenizi girin"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={yukleniyor}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: 8 }}
            >
              {yukleniyor ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>

          <p style={{
            margin: '24px 0 0',
            textAlign: 'center',
            fontSize: 14,
            color: 'var(--text-secondary)',
          }}>
            Hesabın yok mu?{' '}
            <Link to="/register" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
              Kayıt ol
            </Link>
          </p>
        </div>
      </div>

      {/* Mobile responsive: tek kolon */}
      <style>{`
        @media (max-width: 899px) {
          [data-login-sol] { display: none !important; }
          [data-login-wrapper] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function SolPanel() {
  return (
    <div
      data-login-sol="true"
      className="desktop-only"
      style={{
        background: 'linear-gradient(135deg, #0A1A14 0%, #0D1F1A 40%, #1A3328 100%)',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 56,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Arka plan dekorasyonu */}
      <div style={{
        position: 'absolute', top: -100, right: -100,
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)',
      }} />
      <div style={{
        position: 'absolute', bottom: -150, left: -50,
        width: 350, height: 350, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
        <img src="/compass-rose.svg" width={40} height={40} alt="ParaPusula" style={{ display: 'block', filter: 'brightness(0) invert(1)' }} />
        <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>ParaPusula</span>
      </div>

      <div style={{ position: 'relative' }}>
        <h2 className="heading-xl" style={{ color: '#fff', marginBottom: 16, fontWeight: 700 }}>
          Finansal pusulan,<br />cebinde.
        </h2>
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, maxWidth: 420 }}>
          AI destekli ekstre analizi ile harcamalarını anla, borç haritanı çıkar, finansal sağlığını yükselt.
        </p>
      </div>

      <div style={{ position: 'relative', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
        2026 · Verileriniz uçtan uca şifreli işlenir.
      </div>
    </div>
  )
}

function hataMetniCevir(kod) {
  const mesajlar = {
    'auth/user-not-found':         'Bu e-posta ile kayıtlı hesap bulunamadı.',
    'auth/wrong-password':         'Şifre hatalı. Lütfen tekrar deneyin.',
    'auth/invalid-email':          'Geçersiz e-posta adresi.',
    'auth/too-many-requests':      'Çok fazla başarısız deneme. Lütfen bekleyin.',
    'auth/user-disabled':          'Bu hesap devre dışı bırakılmış.',
    'auth/invalid-credential':     'E-posta veya şifre hatalı.',
    'auth/network-request-failed': 'Ağ bağlantısı hatası. İnternet bağlantınızı kontrol edin.',
  }
  return mesajlar[kod] || 'Bir hata oluştu. Lütfen tekrar deneyin.'
}
