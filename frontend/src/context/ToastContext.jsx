// KARAR: Tek context ile sade addToast API; portal kullanmadan z-index 9999 fixed konteyner — basit ve yeterli.
import React, { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast, ToastProvider içinde kullanılmalıdır')
  return ctx
}

let _id = 0

export function ToastProvider({ children }) {
  const [toastlar, setToastlar] = useState([])

  const removeToast = useCallback((id) => {
    setToastlar(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((mesaj, tip = 'info') => {
    const id = ++_id
    setToastlar(prev => [...prev, { id, mesaj, tip }])
    setTimeout(() => removeToast(id), 4000)
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          pointerEvents: 'none',
        }}
      >
        {toastlar.map(t => (
          <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onClose }) {
  // KARAR: Inline minimal stil — animasyon ve renkler tip'e göre seçiliyor.
  const renkler = {
    success: { bg: 'var(--color-positive)', icon: '✓' },
    error:   { bg: 'var(--color-negative)', icon: '!' },
    info:    { bg: 'var(--color-primary)',  icon: 'i' },
  }
  const stil = renkler[toast.tip] || renkler.info

  return (
    <div
      onClick={onClose}
      style={{
        pointerEvents: 'auto',
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minWidth: 280,
        maxWidth: 360,
        cursor: 'pointer',
        animation: 'fadeIn 250ms cubic-bezier(0.34,1.56,0.64,1) both',
        borderLeft: `4px solid ${stil.bg}`,
      }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: stil.bg, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 14, flexShrink: 0,
      }}>{stil.icon}</div>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', flex: 1 }}>{toast.mesaj}</p>
    </div>
  )
}
