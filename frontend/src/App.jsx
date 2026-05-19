// KARAR: Koyu navbar (var(--bg-navbar)) + Framer Motion sayfa geçişleri + aktif gösterge.
// KARAR: ThemeProvider ile dark/light mode; toggle ay/güneş ikonu navbar'da.
import React, { useState, useRef, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { ThemeProvider, useTheme } from './context/ThemeContext.jsx'

import Login from './components/Login.jsx'
import Register from './components/Register.jsx'
import Onboarding from './components/Onboarding.jsx'
import UploadPDF from './components/UploadPDF.jsx'
import Dashboard from './components/Dashboard.jsx'
import DebtMap from './components/DebtMap.jsx'
import Expenses from './components/Expenses.jsx'
import ChatAssistant from './components/ChatAssistant.jsx'
import Simulator from './components/Simulator.jsx'
import Insight from './components/Insight.jsx'

// ─── Pusula İkonu (compass-rose.svg) ───────────────────────────
function PusulaIcon({ size = 28 }) {
  return (
    <img
      src="/compass-rose.svg"
      width={size}
      height={size}
      alt="ParaPusula"
      style={{ display: 'block', filter: 'brightness(0) invert(1)' }}
    />
  )
}

// ─── Dark Mode Toggle ───────────────────────────────────────────
function DarkModeToggle() {
  const { tema, temaDegistir } = useTheme()
  const dark = tema === 'dark'
  return (
    <motion.button
      onClick={temaDegistir}
      title={dark ? 'Açık temaya geç' : 'Koyu temaya geç'}
      whileTap={{ scale: 0.92 }}
      style={{
        width: 36, height: 36,
        borderRadius: 'var(--radius-full)',
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', cursor: 'pointer', flexShrink: 0,
        transition: 'background 150ms ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {dark ? (
          <motion.svg key="sun" width={16} height={16} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            initial={{ opacity: 0, rotate: -90, scale: 0.7 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.7 }}
            transition={{ duration: 0.2 }}>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </motion.svg>
        ) : (
          <motion.svg key="moon" width={16} height={16} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            initial={{ opacity: 0, rotate: 90, scale: 0.7 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: -90, scale: 0.7 }}
            transition={{ duration: 0.2 }}>
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </motion.svg>
        )}
      </AnimatePresence>
    </motion.button>
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
// KARAR: PDF Yükle navdan kaldırıldı; Dashboard'da Upload Card ile erişiliyor.
const NAV_LINKS = [
  { yol: '/dashboard',  etiket: 'Ana Sayfa',     ikon: IconPano },
  { yol: '/expenses',   etiket: 'Harcamalar',     ikon: IconExpense },
  { yol: '/debt',       etiket: 'Borç Haritası',  ikon: IconDebt },
  { yol: '/simulator',  etiket: 'Simülasyon',     ikon: IconSimulator },
  { yol: '/chat',       etiket: 'Asistan',        ikon: IconChat },
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
function IconSimulator({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
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

// ─── Header (Glassmorphism Navbar) ────────────────────────────
function Header() {
  const { kullanici, cikisYap, yukleniyor } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuAcik, setMenuAcik] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAcik(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // KARAR: /insight tam ekran overlay — navbar görünmemeli
  const gizliSayfalar = ['/login', '/register', '/onboarding', '/insight']
  if (gizliSayfalar.includes(location.pathname)) return null
  if (yukleniyor || !kullanici) return null

  async function handleCikis() {
    setMenuAcik(false)
    await cikisYap()
    navigate('/login')
  }

  return (
    <>
      {/* ── Desktop Navbar ──────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--bg-navbar)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        padding: '0 24px', height: 60,
        display: 'flex', alignItems: 'center', gap: 32,
        transition: 'background-color 300ms ease',
      }}>
        {/* Logo */}
        <Link to="/dashboard" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          color: '#fff', fontWeight: 700, fontSize: 17,
          letterSpacing: '-0.02em', flexShrink: 0,
          transition: 'opacity 150ms ease',
        }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          <PusulaIcon size={30} />
          <span>ParaPusula</span>
        </Link>

        {/* Nav linkleri — desktop */}
        <nav className="desktop-only" style={{ display: 'flex', gap: 2, flex: 1, justifyContent: 'center' }}>
          {NAV_LINKS.map(link => {
            const aktif = location.pathname === link.yol
            return (
              <Link
                key={link.yol}
                to={link.yol}
                style={{
                  position: 'relative',
                  padding: '18px 14px',
                  fontSize: 13.5,
                  fontWeight: aktif ? 600 : 400,
                  color: aktif ? '#fff' : 'rgba(255,255,255,0.6)',
                  transition: 'color 150ms ease',
                  letterSpacing: '-0.01em',
                }}
                onMouseEnter={e => { if (!aktif) e.currentTarget.style.color = 'rgba(255,255,255,0.9)' }}
                onMouseLeave={e => { if (!aktif) e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
              >
                {link.etiket}
                {/* Aktif gösterge — animasyonlu çizgi */}
                {aktif && (
                  <motion.span
                    layoutId="navbar-underline"
                    style={{
                      position: 'absolute', bottom: 0, left: 14, right: 14,
                      height: 2,
                      background: 'rgba(255,255,255,0.9)',
                      borderRadius: 2,
                    }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Sağ taraf: dark mode toggle + kullanıcı */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <DarkModeToggle />

          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuAcik(!menuAcik)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                padding: '6px 10px 6px 6px',
                borderRadius: 'var(--radius-full)',
                cursor: 'pointer',
                transition: 'background 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
              }}>
                {(kullanici.email || '?')[0].toUpperCase()}
              </div>
              <span className="desktop-only" style={{
                fontSize: 13, color: 'rgba(255,255,255,0.75)',
                maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {kullanici.email}
              </span>
            </button>

            {menuAcik && (
              <motion.div
                className="card"
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.15 }}
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
              </motion.div>
            )}
          </div>
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
        {NAV_LINKS.filter(l => l.yol !== '/expenses' && l.yol !== '/simulator').map(link => {
          const aktif = location.pathname === link.yol
          const Icon = link.ikon
          return (
            <Link
              key={link.yol}
              to={link.yol}
              style={{
                flex: 1, maxWidth: 80,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '8px 4px',
                color: aktif ? 'var(--color-primary)' : 'var(--text-tertiary)',
                fontSize: 10, fontWeight: aktif ? 600 : 500,
              }}
            >
              <Icon size={20} />
              <span>{link.etiket}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}

// ─── Framer Motion sayfa geçişi ────────────────────────────────
const sayfaVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
}

function SayfaWrapper({ children }) {
  const location = useLocation()
  return (
    <motion.div
      key={location.pathname}
      variants={sayfaVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ flex: 1 }}
    >
      {children}
    </motion.div>
  )
}

function AppIcerik() {
  const location = useLocation()
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/login"    element={<HerkesAcikRota><SayfaWrapper><Login /></SayfaWrapper></HerkesAcikRota>} />
          <Route path="/register" element={<HerkesAcikRota><SayfaWrapper><Register /></SayfaWrapper></HerkesAcikRota>} />
          <Route path="/onboarding" element={<KorunanRota><SayfaWrapper><Onboarding /></SayfaWrapper></KorunanRota>} />
          <Route path="/dashboard" element={<KorunanRota><SayfaWrapper><Dashboard /></SayfaWrapper></KorunanRota>} />
          <Route path="/upload"    element={<KorunanRota><SayfaWrapper><UploadPDF /></SayfaWrapper></KorunanRota>} />
          <Route path="/debt"      element={<KorunanRota><SayfaWrapper><DebtMap /></SayfaWrapper></KorunanRota>} />
          <Route path="/expenses"  element={<KorunanRota><SayfaWrapper><Expenses /></SayfaWrapper></KorunanRota>} />
          <Route path="/insight"   element={<KorunanRota><Insight /></KorunanRota>} />
          <Route path="/simulator" element={<KorunanRota><SayfaWrapper><Simulator /></SayfaWrapper></KorunanRota>} />
          <Route path="/chat"      element={<KorunanRota><SayfaWrapper><ChatAssistant /></SayfaWrapper></KorunanRota>} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </AnimatePresence>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <AppIcerik />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
