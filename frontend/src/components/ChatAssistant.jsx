// KARAR: Sticky input alt bar; auto-scroll smooth; ilk açılışta karşılama + chip sorular.
import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { chat } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'

const ORNEK_SORULAR = [
  'Bu ay neye en çok harcadım?',
  'Borçtan en hızlı nasıl çıkarım?',
  'Aboneliklerimi kessem ne olur?',
]

const MAX_KARAKTER = 5000

const KARSILAMA = 'Merhaba! Ben ParaPusula finansal asistanın. Banka ekstrene ve finansal durumuna bakarak sana özel cevap verebiliyorum. Aşağıdan örnek soruları seçebilir veya kendi sorunu yazabilirsin.'

export default function ChatAssistant() {
  const { kullanici } = useAuth()
  const userId = kullanici?.uid || localStorage.getItem('parapusula_user_id') || ''

  const sonRef = useRef(null)
  const taRef = useRef(null)

  const [mesajlar, setMesajlar] = useState([
    { id: 1, kimden: 'asistan', metin: KARSILAMA, zaman: new Date() },
  ])
  const [giris, setGiris] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)

  useEffect(() => {
    sonRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mesajlar, yukleniyor])

  // Textarea autosize
  useEffect(() => {
    if (!taRef.current) return
    taRef.current.style.height = 'auto'
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 140) + 'px'
  }, [giris])

  async function gonder(metin) {
    const txt = (metin ?? giris).trim()
    if (!txt || yukleniyor) return
    if (txt.length > MAX_KARAKTER) return

    const yeni = { id: Date.now(), kimden: 'kullanici', metin: txt, zaman: new Date() }
    setMesajlar(prev => [...prev, yeni])
    setGiris('')
    setYukleniyor(true)

    try {
      const yanit = await chat(userId, txt)
      setMesajlar(prev => [...prev, {
        id: Date.now() + 1, kimden: 'asistan',
        metin: yanit.yanit || 'Yanıt alınamadı.',
        zaman: new Date(),
      }])
    } catch (err) {
      setMesajlar(prev => [...prev, {
        id: Date.now() + 1, kimden: 'asistan',
        metin: `Üzgünüm, şu an yanıt veremiyorum. (${err.message})`,
        zaman: new Date(), hata: true,
      }])
    } finally {
      setYukleniyor(false)
    }
  }

  function tusBasildi(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      gonder()
    }
  }

  // Sadece tek karşılama mesajı varsa örnek soruları göster
  const ilkAcilis = mesajlar.length === 1

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        minHeight: 'calc(100vh - 64px)',
        background: '#F1F5F9',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Sticky header */}
      <div className="glass" style={{
        position: 'sticky', top: 64, zIndex: 50,
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <h1 className="heading-sm" style={{ marginBottom: 2 }}>Finansal Asistan</h1>
          <p className="text-small" style={{ margin: 0 }}>
            Verilerine bakarak sana özel cevap veriyor
          </p>
        </div>
      </div>

      {/* Mesaj alanı */}
      <div style={{
        flex: 1,
        padding: '24px 16px 180px',
        overflowY: 'auto',
      }}>
        <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {mesajlar.map(m => (
            <Balon key={m.id} mesaj={m} />
          ))}

          {/* Typing indicator */}
          {yukleniyor && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <Avatar tip="asistan" />
              <div style={{
                background: '#F1F5F9',
                borderRadius: '18px 18px 18px 4px',
                padding: '14px 18px',
                boxShadow: 'var(--shadow-sm)',
                border: '1px solid var(--border-subtle)',
                display: 'flex', gap: 6,
              }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: 'var(--text-tertiary)',
                    animation: `typingDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}

          {/* Örnek sorular (sadece ilk açılışta) */}
          {ilkAcilis && !yukleniyor && (
            <div className="animate-fade-in" style={{ marginTop: 8, marginLeft: 46 }}>
              <p className="text-tiny" style={{ marginBottom: 10 }}>Örnek sorular</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ORNEK_SORULAR.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => gonder(s)}
                    className="btn btn-secondary"
                    style={{ fontSize: 13, padding: '10px 16px' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={sonRef} />
        </div>
      </div>

      {/* Sabit input bar */}
      <div className="glass" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '16px 16px calc(16px + env(safe-area-inset-bottom))',
        borderTop: '1px solid var(--border-subtle)',
        zIndex: 50,
      }}>
        <div style={{
          maxWidth: 820, margin: '0 auto',
          display: 'flex', gap: 12, alignItems: 'flex-end',
        }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              ref={taRef}
              value={giris}
              onChange={(e) => setGiris(e.target.value)}
              onKeyDown={tusBasildi}
              placeholder="Finansal durumun hakkında bir soru sor..."
              disabled={yukleniyor}
              rows={1}
              className="input"
              style={{
                resize: 'none', minHeight: 48, maxHeight: 140,
                padding: '14px 16px', borderRadius: 'var(--radius-lg)',
                width: '100%',
                background: '#FFFFFF',
                borderColor: giris.length > MAX_KARAKTER ? 'var(--color-negative)' : undefined,
                '--input-focus-border': '#0D9488',
                '--input-focus-shadow': '0 0 0 3px rgba(13,148,136,0.15)',
              }}
            />
            {giris.length > 4000 && (
              <p style={{
                position: 'absolute', bottom: -18, right: 4,
                margin: 0, fontSize: 11, fontWeight: 500,
                color: giris.length > MAX_KARAKTER ? 'var(--color-negative)' : 'var(--text-tertiary)',
              }}>
                {giris.length}/{MAX_KARAKTER}
              </p>
            )}
          </div>
          <button
            onClick={() => gonder()}
            disabled={!giris.trim() || yukleniyor || giris.length > MAX_KARAKTER}
            className="btn btn-primary"
            style={{
              width: 48, height: 48, padding: 0, borderRadius: 'var(--radius-lg)',
              flexShrink: 0,
              background: '#0D9488',
              '--btn-hover-bg': '#0F766E',
            }}
            aria-label="Gönder"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
        <p className="text-tiny" style={{ textAlign: 'center', marginTop: 8, marginBottom: 0, textTransform: 'none', letterSpacing: 0 }}>
          ParaPusula AI eğitim amaçlıdır, yatırım tavsiyesi vermez.
        </p>
      </div>

      <style>{`
        @keyframes typingDot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-4px); }
        }
      `}</style>
    </motion.div>
  )
}

function Avatar({ tip }) {
  if (tip === 'asistan') {
    return (
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: '#0D9488', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width={18} height={18} viewBox="0 0 32 32">
          <path d="M16 6 L19 16 L16 26 L13 16 Z" fill="#F59E0B" />
          <circle cx="16" cy="16" r="2" fill="#fff" />
        </svg>
      </div>
    )
  }
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: 'var(--color-primary-soft)', color: 'var(--color-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 700, flexShrink: 0,
    }}>S</div>
  )
}

function Balon({ mesaj }) {
  const ben = mesaj.kimden === 'kullanici'
  return (
    <div className="animate-fade-in" style={{
      display: 'flex', flexDirection: ben ? 'row-reverse' : 'row',
      alignItems: 'flex-end', gap: 10,
    }}>
      <Avatar tip={mesaj.kimden} />
      <div style={{ maxWidth: '75%', minWidth: 0 }}>
        <div style={{
          padding: '12px 16px',
          borderRadius: ben ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          background: mesaj.hata
            ? 'rgba(239,68,68,0.06)'
            : ben ? '#1E293B' : '#F1F5F9',
          color: mesaj.hata ? '#B91C1C' : ben ? '#fff' : '#1E293B',
          fontSize: 14, lineHeight: 1.55,
          boxShadow: ben ? 'none' : 'var(--shadow-sm)',
          border: ben ? 'none' : (mesaj.hata ? '1px solid rgba(239,68,68,0.2)' : '1px solid var(--border-subtle)'),
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
        }}>
          {mesaj.metin}
        </div>
        <p className="text-tiny" style={{
          margin: '4px 4px 0', textAlign: ben ? 'right' : 'left',
          textTransform: 'none', letterSpacing: 0,
        }}>
          {mesaj.zaman.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}
