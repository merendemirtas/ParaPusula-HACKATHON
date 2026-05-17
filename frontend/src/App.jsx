import React from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'

import Login from './components/Login.jsx'
import Register from './components/Register.jsx'
import Onboarding from './components/Onboarding.jsx'
import UploadPDF from './components/UploadPDF.jsx'
import Dashboard from './components/Dashboard.jsx'
import DebtMap from './components/DebtMap.jsx'
import Expenses from './components/Expenses.jsx'
import ChatAssistant from './components/ChatAssistant.jsx'

// ─────────────────────────────────────────────
// Yükleniyor ekranı (Firebase auth durumu belli olana kadar)
// ─────────────────────────────────────────────
function YukleniyorEkrani() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f0f4f8',
    }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '18px', color: '#4a5568', fontWeight: '600' }}>
          ParaPusula yükleniyor...
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Korunan rota: giriş yapılmamışsa /login'e yönlendir
// ─────────────────────────────────────────────
function KorunanRota({ children }) {
  const { kullanici, yukleniyor } = useAuth()

  if (yukleniyor) return <YukleniyorEkrani />
  if (!kullanici) return <Navigate to="/login" replace />
  return children
}

// ─────────────────────────────────────────────
// Herkese açık rota: giriş yapılmışsa yönlendir
// ─────────────────────────────────────────────
function HerkesAcikRota({ children }) {
  const { kullanici, yukleniyor } = useAuth()

  if (yukleniyor) return <YukleniyorEkrani />
  if (kullanici) return <Navigate to="/dashboard" replace />
  return children
}

// ─────────────────────────────────────────────
// Header (navbar + çıkış butonu)
// ─────────────────────────────────────────────
function Header() {
  const { kullanici, cikisYap, yukleniyor } = useAuth()
  const location = useLocation()

  // Auth sayfalarında header gösterme
  const gizliSayfalar = ['/login', '/register', '/onboarding']
  if (gizliSayfalar.includes(location.pathname)) return null
  if (yukleniyor || !kullanici) return null

  const navLinks = [
    { yol: '/dashboard', etiket: 'Pano' },
    { yol: '/upload',    etiket: 'PDF Yükle' },
    { yol: '/debt',      etiket: 'Borç Haritası' },
    { yol: '/expenses',  etiket: 'Harcamalar' },
    { yol: '/chat',      etiket: 'Asistan' },
  ]

  return (
    <nav style={navStil}>
      <Link to="/dashboard" style={logoStil}>ParaPusula</Link>

      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {navLinks.map(link => (
          <Link
            key={link.yol}
            to={link.yol}
            style={location.pathname === link.yol ? aktifLinkStil : linkStil}
          >
            {link.etiket}
          </Link>
        ))}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={emailStil}>{kullanici.email}</span>
        <button onClick={cikisYap} style={cikisButonStil}>
          Çıkış Yap
        </button>
      </div>
    </nav>
  )
}

// ─────────────────────────────────────────────
// Ana uygulama (router içinde)
// ─────────────────────────────────────────────
function AppIcerik() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <Routes>
          {/* Herkese açık rotalar */}
          <Route path="/login"    element={<HerkesAcikRota><Login /></HerkesAcikRota>} />
          <Route path="/register" element={<HerkesAcikRota><Register /></HerkesAcikRota>} />

          {/* Onboarding: giriş yapılmış olmalı */}
          <Route path="/onboarding" element={<KorunanRota><Onboarding /></KorunanRota>} />

          {/* Korunan rotalar */}
          <Route path="/dashboard" element={<KorunanRota><Dashboard /></KorunanRota>} />
          <Route path="/upload"    element={<KorunanRota><UploadPDF /></KorunanRota>} />
          <Route path="/debt"      element={<KorunanRota><DebtMap /></KorunanRota>} />
          <Route path="/expenses"  element={<KorunanRota><Expenses /></KorunanRota>} />
          <Route path="/chat"      element={<KorunanRota><ChatAssistant /></KorunanRota>} />

          {/* Kök yol: giriş yapmamışsa /login'e */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </main>
    </div>
  )
}

// ─────────────────────────────────────────────
// Kök bileşen
// ─────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppIcerik />
      </AuthProvider>
    </BrowserRouter>
  )
}

// ─── Stiller ─────────────────────────────────────────────────────────────

const navStil = {
  backgroundColor: '#1a365d',
  padding: '0 24px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  position: 'sticky',
  top: 0,
  zIndex: 100,
  minHeight: '56px',
  flexWrap: 'wrap',
}

const logoStil = {
  color: '#63b3ed',
  fontWeight: '700',
  fontSize: '20px',
  textDecoration: 'none',
  marginRight: '12px',
  letterSpacing: '-0.5px',
  whiteSpace: 'nowrap',
}

const linkStil = {
  color: '#a0aec0',
  textDecoration: 'none',
  padding: '6px 10px',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: '500',
}

const aktifLinkStil = {
  ...linkStil,
  color: '#fff',
  backgroundColor: '#2b6cb0',
}

const emailStil = {
  color: '#718096',
  fontSize: '12px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '160px',
}

const cikisButonStil = {
  padding: '6px 14px',
  backgroundColor: 'transparent',
  border: '1px solid #4a5568',
  borderRadius: '6px',
  color: '#a0aec0',
  fontSize: '13px',
  fontWeight: '500',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
