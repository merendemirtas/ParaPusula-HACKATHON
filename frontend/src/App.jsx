// KARAR: Koyu navbar (#1E293B) + Framer Motion sayfa geçişleri + teal aktif göstergesi.
import React, { useState, useRef, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
import Simulator from './components/Simulator.jsx'
import Insight from './components/Insight.jsx'

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
// KARAR: PDF Yükle navdan kaldırıldı; Dashboard'da Upload Card ile erişiliyor.
const NAV_LINKS = [
  { yol: '/dashboard',  etiket: 'Dashboard',    ikon: IconPano },
  { yol: '/debt',       etiket: 'Borç Haritası', ikon: IconDebt },
  { yol: '/expenses',   etiket: 'Harcamalar',   ikon: IconExpense },
  { yol: '/simulator',  etiket: 'Simülatör',    ikon: IconSimulator },
  { yol: '/chat',       etiket: 'Asistan',      ikon: IconChat },
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

// ─── Header (Koyu Navbar) ──────────────────────────────────────
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
        boxShadow: '0 1px 0 rgba(255,255,255,0.06), 0 4px 12px rgba(0,0,0,0.15)',
        padding: '0 24px', height: 60,
        display: 'flex', alignItems: 'center', gap: 32,
      }}>
        {/* Logo */}
        <Link to="/dashboard" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          color: '#fff', fontWeight: 700, fontSize: 17,
          letterSpacing: '-0.02em', flexShrink: 0,
        }}>
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
                {/* Aktif gösterge — teal çizgi */}
                {aktif && (
                  <motion.span
                    layoutId="navbar-underline"
                    style={{
                      position: 'absolute', bottom: 0, left: 14, right: 14,
                      height: 2, background: '#0D9488', borderRadius: 2,
                    }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Kullanıcı menüsü */}
        <div ref={menuRef} style={{ marginLeft: 'auto', position: 'relative' }}>
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
              background: 'var(--color-primary)', color: '#fff',
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
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -6 },
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
      transition={{ duration: 0.22, ease: 'easeOut' }}
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
      <AuthProvider>
        <ToastProvider>
          <AppIcerik />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
