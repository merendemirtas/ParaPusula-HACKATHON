// Kayıt ol sayfası
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase.js'

export default function Register() {
  const [form, setForm] = useState({ email: '', sifre: '', sifreTekrar: '' })
  const [hata, setHata] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const navigate = useNavigate()

  function handleDegisim(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setHata('')
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (form.sifre !== form.sifreTekrar) {
      setHata('Şifreler eşleşmiyor.')
      return
    }
    if (form.sifre.length < 6) {
      setHata('Şifre en az 6 karakter olmalıdır.')
      return
    }

    setYukleniyor(true)
    setHata('')

    try {
      await createUserWithEmailAndPassword(auth, form.email, form.sifre)
      // Kayıt başarılı → onboarding'e yönlendir (ilk kez giriş)
      navigate('/onboarding', { replace: true })
    } catch (err) {
      setHata(hataMetniCevir(err.code))
    } finally {
      setYukleniyor(false)
    }
  }

  return (
    <div style={kapsayiciStil}>
      <div style={kartStil}>
        <div style={logoAlaniStil}>
          <h1 style={logoStil}>ParaPusula</h1>
          <p style={sloganStil}>Finansal özgürlüğünün pusulası</p>
        </div>

        <h2 style={baslikStil}>Hesap Oluştur</h2>

        <form onSubmit={handleSubmit} style={formStil}>
          <div style={alanGrubuStil}>
            <label style={etiketStil}>E-posta</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleDegisim}
              placeholder="ornek@email.com"
              required
              style={inputStil}
              autoComplete="email"
            />
          </div>

          <div style={alanGrubuStil}>
            <label style={etiketStil}>Şifre</label>
            <input
              name="sifre"
              type="password"
              value={form.sifre}
              onChange={handleDegisim}
              placeholder="En az 6 karakter"
              required
              style={inputStil}
              autoComplete="new-password"
            />
          </div>

          <div style={alanGrubuStil}>
            <label style={etiketStil}>Şifre Tekrar</label>
            <input
              name="sifreTekrar"
              type="password"
              value={form.sifreTekrar}
              onChange={handleDegisim}
              placeholder="Şifrenizi tekrar girin"
              required
              style={inputStil}
              autoComplete="new-password"
            />
          </div>

          {hata && <p style={hataStil}>{hata}</p>}

          <button
            type="submit"
            disabled={yukleniyor}
            style={yukleniyor ? { ...butonStil, opacity: 0.7 } : butonStil}
          >
            {yukleniyor ? 'Hesap oluşturuluyor...' : 'Kayıt Ol'}
          </button>
        </form>

        <p style={altMetinStil}>
          Zaten hesabın var mı?{' '}
          <Link to="/login" style={linkStil}>Giriş yap</Link>
        </p>
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

// ─── Stiller ───────────────────────────────────────────────────────────────

const kapsayiciStil = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#f0f4f8',
  padding: '24px',
}

const kartStil = {
  backgroundColor: '#fff',
  borderRadius: '16px',
  padding: '40px',
  width: '100%',
  maxWidth: '400px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
}

const logoAlaniStil = {
  textAlign: 'center',
  marginBottom: '32px',
}

const logoStil = {
  margin: 0,
  fontSize: '28px',
  fontWeight: '800',
  color: '#1a365d',
  letterSpacing: '-1px',
}

const sloganStil = {
  margin: '4px 0 0',
  fontSize: '13px',
  color: '#718096',
}

const baslikStil = {
  margin: '0 0 24px',
  fontSize: '20px',
  fontWeight: '700',
  color: '#2d3748',
  textAlign: 'center',
}

const formStil = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
}

const alanGrubuStil = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
}

const etiketStil = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#4a5568',
}

const inputStil = {
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1.5px solid #e2e8f0',
  fontSize: '15px',
  outline: 'none',
  color: '#2d3748',
}

const hataStil = {
  margin: 0,
  padding: '10px 14px',
  backgroundColor: '#fff5f5',
  border: '1px solid #feb2b2',
  borderRadius: '8px',
  color: '#c53030',
  fontSize: '13px',
}

const butonStil = {
  marginTop: '8px',
  padding: '12px',
  backgroundColor: '#2b6cb0',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: '600',
  cursor: 'pointer',
}

const altMetinStil = {
  margin: '20px 0 0',
  textAlign: 'center',
  fontSize: '14px',
  color: '#718096',
}

const linkStil = {
  color: '#2b6cb0',
  fontWeight: '600',
  textDecoration: 'none',
}
