// Giriş yap sayfası
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase.js'
import { getHealthScore } from '../services/api.js'

export default function Login() {
  const [form, setForm] = useState({ email: '', sifre: '' })
  const [hata, setHata] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const navigate = useNavigate()

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

      // Onboarding yapıldı mı kontrol et
      try {
        await getHealthScore(uid)
        // Skor geldi → dashboard'a yönlendir
        navigate('/dashboard', { replace: true })
      } catch {
        // Henüz onboarding yapılmamış → onboarding'e yönlendir
        navigate('/onboarding', { replace: true })
      }
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

        <h2 style={baslikStil}>Giriş Yap</h2>

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
              placeholder="Şifrenizi girin"
              required
              style={inputStil}
              autoComplete="current-password"
            />
          </div>

          {hata && <p style={hataStil}>{hata}</p>}

          <button
            type="submit"
            disabled={yukleniyor}
            style={yukleniyor ? { ...butonStil, opacity: 0.7 } : butonStil}
          >
            {yukleniyor ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        <p style={altMetinStil}>
          Hesabın yok mu?{' '}
          <Link to="/register" style={linkStil}>Kayıt ol</Link>
        </p>
      </div>
    </div>
  )
}

// Firebase hata kodlarını Türkçeye çevir
function hataMetniCevir(kod) {
  const mesajlar = {
    'auth/user-not-found':      'Bu e-posta ile kayıtlı hesap bulunamadı.',
    'auth/wrong-password':      'Şifre hatalı. Lütfen tekrar deneyin.',
    'auth/invalid-email':       'Geçersiz e-posta adresi.',
    'auth/too-many-requests':   'Çok fazla başarısız deneme. Lütfen bekleyin.',
    'auth/user-disabled':       'Bu hesap devre dışı bırakılmış.',
    'auth/invalid-credential':  'E-posta veya şifre hatalı.',
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
  transition: 'border-color 0.15s',
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
  transition: 'background-color 0.15s',
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
