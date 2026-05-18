// KARAR: Login ile aynı split-screen iskelet; tekrar yerine farklı slogan ve şifre tekrar alanı.
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase.js'
import { useToast } from '../context/ToastContext.jsx'

export default function Register() {
  const [form, setForm] = useState({ email: '', sifre: '', sifreTekrar: '' })
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
    if (form.sifre !== form.sifreTekrar) { setHata('Şifreler eşleşmiyor.'); return }
    if (form.sifre.length < 6) { setHata('Şifre en az 6 karakter olmalıdır.'); return }

    setYukleniyor(true); setHata('')
    try {
      await createUserWithEmailAndPassword(auth, form.email, form.sifre)
      addToast('Hesabın oluşturuldu. Sırada onboarding var.', 'success')
      navigate('/onboarding', { replace: true })
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
      <SolPanel />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="animate-fade-in" style={{ width: '100%', maxWidth: 420 }}>
          <h1 className="heading-lg" style={{ marginBottom: 8 }}>Hesap Oluştur</h1>
          <p className="text-body" style={{ marginBottom: 32 }}>
            30 saniyede başla, finansal pusulanı kur.
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
            }}>{hata}</div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label className="label" htmlFor="email">E-posta</label>
              <input id="email" name="email" type="email" className="input"
                value={form.email} onChange={handleDegisim}
                placeholder="ornek@email.com" required autoComplete="email" />
            </div>
            <div>
              <label className="label" htmlFor="sifre">Şifre</label>
              <input id="sifre" name="sifre" type="password" className="input"
                value={form.sifre} onChange={handleDegisim}
                placeholder="En az 6 karakter" required autoComplete="new-password" />
            </div>
            <div>
              <label className="label" htmlFor="sifreTekrar">Şifre Tekrar</label>
              <input id="sifreTekrar" name="sifreTekrar" type="password" className="input"
                value={form.sifreTekrar} onChange={handleDegisim}
                placeholder="Şifrenizi tekrar girin" required autoComplete="new-password" />
            </div>

            <button type="submit" disabled={yukleniyor}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: 8 }}>
              {yukleniyor ? 'Hesap oluşturuluyor...' : 'Kayıt Ol'}
            </button>
          </form>

          <p style={{
            margin: '24px 0 0', textAlign: 'center',
            fontSize: 14, color: 'var(--text-secondary)',
          }}>
            Zaten hesabın var mı?{' '}
            <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Giriş yap</Link>
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 899px) {
          [data-reg-sol] { display: none !important; }
        }
      `}</style>
    </div>
  )
}

function SolPanel() {
  return (
    <div
      data-reg-sol="true"
      className="desktop-only"
      style={{
        background: 'linear-gradient(135deg, #0F4C3A 0%, #167256 50%, #0A3528 100%)',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 56,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
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
        <svg width={40} height={40} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="15" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" />
          <path d="M16 6 L19 16 L16 26 L13 16 Z" fill="#F59E0B" />
          <circle cx="16" cy="16" r="2" fill="#fff" />
        </svg>
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
    'auth/email-already-in-use':   'Bu e-posta adresi zaten kullanımda.',
    'auth/invalid-email':          'Geçersiz e-posta adresi.',
    'auth/weak-password':          'Şifre çok zayıf. Daha güçlü bir şifre seçin.',
    'auth/operation-not-allowed':  'E-posta/şifre girişi etkinleştirilmemiş.',
    'auth/network-request-failed': 'Ağ bağlantısı hatası. İnternet bağlantınızı kontrol edin.',
  }
  return mesajlar[kod] || 'Bir hata oluştu. Lütfen tekrar deneyin.'
}
