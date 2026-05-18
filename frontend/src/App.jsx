// KARAR: Sticky glass header + mobile bottom nav; logo inline SVG pusula; route geçişlerinde fade-in.
import React, { useState, useRef, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'

import Login from './components/Login.jsx'
import Register from './components/Register.jsx'
import Onboarding from './components/Onboarding.jsx'
import UploadPDF from './components/UploadPDF.jsx'
import Dashboard from './components/Dashboard.jsx'
import DebtMap from './components/DebtMap.jsx'
import Expenses from './components/Expenses.jsx'
import ChatAssistant from './components/ChatAssistant.jsx'

// ─── Pusula SVG (inline, ölçeklenebilir) ───────────────────────
function PusulaIcon({ size = 28 }) {
  // KARAR: Koyu yeşil daire + altın iğne; basit ama tanınır.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="15" fill="var(--color-primary)" />
      <circle cx="16" cy="16" r="11" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
      <path d="M16 6 L19 16 L16 26 L13 16 Z" fill="var(--color-accent)" />
      <circle cx="16" cy="16" r="2" fill="#fff" />
    </svg>
  )
}

function YukleniyorEkrani() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-page)', flexDirection: 'column', gap: 16,
    }}>
      <PusulaIcon size={56} />
      <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>ParaPusula hazırlanıyor...</p>
    </div>
  )
}

function KorunanRota({ children }) {
  const { kullanici, yukleniyor } = useAuth()
  if (yukleniyor) return <YukleniyorEkrani />
  if (!kullanici) return <Navigate to="/login" replace />
  return children
}

function HerkesAcikRota({ children }) {
  const { kullanici, yukleniyor } = useAuth()
  if (yukleniyor) return <YukleniyorEkrani />
  if (kullanici) return <Navigate to="/dashboard" replace />
  return children
}

// ─── Nav linkler — tek kaynak ──────────────────────────────────
const NAV_LINKS = [
  { yol: '/dashboard', etiket: 'Pano',         ikon: IconPano },
  { yol: '/upload',    etiket: 'PDF Yükle',    ikon: IconUpload },
  { yol: '/debt',      etiket: 'Borç Haritası', ikon: IconDebt },
  { yol: '/expenses',  etiket: 'Harcamalar',   ikon: IconExpense },
  { yol: '/chat',      etiket: 'Asistan',      ikon: IconChat },
]

function IconPano({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  )
}
function IconUpload({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4M6 10l6-6 6 6" />
      <path d="M4 20h16" />
    </svg>
  )
}
function IconDebt({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9 9.5c0-1.4 1.3-2 3-2s3 0.6 3 2-1.3 2-3 2-3 0.6-3 2 1.3 2 3 2 3-0.6 3-2" />
    </svg>
  )
}
function IconExpense({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 4 4 5-6" />
    </svg>
  )
}
function IconChat({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-11.7 7.1L4 21l1.9-5.3A8 8 0 1 1 21 12z" />
    </svg>
  )
}

// ─── Header (Desktop) ──────────────────────────────────────────
function Header() {
  const { kullanici, cikisYap, yukleniyor } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuAcik, setMenuAcik] = useState(false)
  const menuRef = useRef(null)

  // Dropdown dışına tıklayınca kapat
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAcik(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const gizliSayfalar = ['/login', '/register', '/onboarding']
  if (gizliSayfalar.includes(location.pathname)) return null
  if (yukleniyor || !kullanici) return null

  async function handleCikis() {
    setMenuAcik(false)
    await cikisYap()
    navigate('/login')
  }

  return (
    <>
      <header
        className="glass"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          padding: '0 24px',
          height: 64,
          display: 'flex',
          alignItems: 'center',
          gap: 32,
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {/* Logo */}
        <Link to="/dashboard" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          color: 'var(--color-primary)', fontWeight: 700, fontSize: 18,
          letterSpacing: '-0.02em',
        }}>
          <PusulaIcon size={32} />
          <span>ParaPusula</span>
        </Link>

        {/* Nav (desktop) */}
        <nav className="desktop-only" style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'center' }}>
          {NAV_LINKS.map(link => {
            const aktif = location.pathname === link.yol
            return (
              <Link
                key={link.yol}
                to={link.yol}
                style={{
                  position: 'relative',
                  padding: '20px 14px',
                  fontSize: 14,
                  fontWeight: 500,
                  color: aktif ? 'var(--color-primary)' : 'var(--text-secondary)',
                  transition: 'color var(--transition-fast)',
                }}
              >
                {link.etiket}
                {aktif && (
                  <span style={{
                    position: 'absolute', bottom: 0, left: 14, right: 14,
                    height: 2, background: 'var(--color-accent)', borderRadius: 2,
                  }} />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Sağ: kullanıcı menüsü */}
        <div ref={menuRef} style={{ marginLeft: 'auto', position: 'relative' }}>
          <button
            onClick={() => setMenuAcik(!menuAcik)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'transparent', border: '1px solid var(--border-default)',
              padding: '8px 12px', borderRadius: 'var(--radius-full)',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--color-primary)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
            }}>
              {(kullanici.email || '?')[0].toUpperCase()}
            </div>
            <span className="desktop-only" style={{
              fontSize: 13, color: 'var(--text-secondary)',
              maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {kullanici.email}
            </span>
          </button>

          {menuAcik && (
            <div
              className="card animate-fade-scale"
              style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                minWidth: 220, padding: 8, zIndex: 200,
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>Hesap</p>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {kullanici.email}
                </p>
              </div>
              <button
                onClick={handleCikis}
                className="btn btn-ghost"
                style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--color-negative)' }}
              >
                Çıkış Yap
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav
        className="mobile-only glass"
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 8px',
          borderTop: '1px solid var(--border-subtle)',
          zIndex: 100,
        }}
      >
        {/* KARAR: Mobilde 4 ana sekme — Harcamalar dropdown'a alındı; chat dahil. */}
        {NAV_LINKS.filter(l => l.yol !== '/expenses').map(link => {
          const aktif = location.pathname === link.yol
          const Icon = link.ikon
          return (
            <Link
              key={link.yol}
              to={link.yol}
              style={{
                flex: 1, maxWidth: 80,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px 4px',
                color: aktif ? 'var(--color-primary)' : 'var(--text-tertiary)',
                fontSize: 10, fontWeight: 600,
              }}
            >
              <Icon size={22} />
              <span>{link.etiket}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}

// ─── Route geçişlerinde fade-in için wrapper ───────────────────
function SayfaWrapper({ children }) {
  const location = useLocation()
  return (
    <div key={location.pathname} className="animate-fade-in" style={{ flex: 1 }}>
      {children}
    </div>
  )
}

function AppIcerik() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <Routes>
          <Route path="/login"    element={<HerkesAcikRota><SayfaWrapper><Login /></SayfaWrapper></HerkesAcikRota>} />
          <Route path="/register" element={<HerkesAcikRota><SayfaWrapper><Register /></SayfaWrapper></HerkesAcikRota>} />
          <Route path="/onboarding" element={<KorunanRota><SayfaWrapper><Onboarding /></SayfaWrapper></KorunanRota>} />
          <Route path="/dashboard" element={<KorunanRota><SayfaWrapper><Dashboard /></SayfaWrapper></KorunanRota>} />
          <Route path="/upload"    element={<KorunanRota><SayfaWrapper><UploadPDF /></SayfaWrapper></KorunanRota>} />
          <Route path="/debt"      element={<KorunanRota><SayfaWrapper><DebtMap /></SayfaWrapper></KorunanRota>} />
          <Route path="/expenses"  element={<KorunanRota><SayfaWrapper><Expenses /></SayfaWrapper></KorunanRota>} />
          <Route path="/chat"      element={<KorunanRota><SayfaWrapper><ChatAssistant /></SayfaWrapper></KorunanRota>} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppIcerik />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
