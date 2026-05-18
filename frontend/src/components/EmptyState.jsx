// KARAR: Generic, prop-driven empty state — icon (ReactNode), baslik, aciklama, action (ReactNode buton).
import React from 'react'

export default function EmptyState({ icon, baslik, aciklama, action }) {
  return (
    <div
      className="card animate-fade-in"
      style={{
        textAlign: 'center',
        padding: '64px 32px',
        maxWidth: 520,
        margin: '0 auto',
      }}
    >
      {icon && (
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'var(--color-primary-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
          color: 'var(--color-primary)',
        }}>
          {icon}
        </div>
      )}
      {baslik && (
        <h2 className="heading-md" style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>
          {baslik}
        </h2>
      )}
      {aciklama && (
        <p className="text-body" style={{ margin: '0 0 28px' }}>
          {aciklama}
        </p>
      )}
      {action}
    </div>
  )
}
