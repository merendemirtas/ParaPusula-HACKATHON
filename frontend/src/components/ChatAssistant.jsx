import React, { useState, useEffect, useRef } from 'react'
import { chat } from '../services/api.js'

// Mesaj balonunun zamanini formatlama
const zamanDuzenle = (tarih) => {
  return tarih.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

// Oneri mesajlari
const ONERI_MESAJLAR = [
  'Bu ay nerede fazla harcadim?',
  'Borclarimdan nasil kurtulabilirim?',
  'Finansal skorumu nasil arttirabilirim?',
  'Enflasyona karsi ne yapmaliyim?',
  'Aboneliklerim ne kadar tutuyor?',
]

export default function ChatAssistant() {
  const userId = localStorage.getItem('parapusula_user_id') || ''
  const mesajSonuRef = useRef(null)

  const [mesajlar, setMesajlar] = useState([
    {
      id: 1,
      kimden: 'asistan',
      metin: 'Merhaba! Ben ParaPusula finansal asistaniyim. Banka ekstrene ve finansal durumuna bakabiliyorum. Ne ogrennek istersin?',
      zaman: new Date(),
    },
  ])
  const [girisMetni, setGirisMetni] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)

  // Yeni mesaj geldiginde en alta kaydır
  useEffect(() => {
    mesajSonuRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mesajlar])

  // Mesaj gonder
  const mesajGonder = async (metin) => {
    const gonderilecekMetin = metin || girisMetni.trim()
    if (!gonderilecekMetin || yukleniyor) return

    const yeniKullaniciMesaji = {
      id: Date.now(),
      kimden: 'kullanici',
      metin: gonderilecekMetin,
      zaman: new Date(),
    }

    setMesajlar(prev => [...prev, yeniKullaniciMesaji])
    setGirisMetni('')
    setYukleniyor(true)

    try {
      const yanit = await chat(userId, gonderilecekMetin)

      const asistanMesaji = {
        id: Date.now() + 1,
        kimden: 'asistan',
        metin: yanit.yanit || 'Yanit alinamadi.',
        zaman: new Date(),
      }

      setMesajlar(prev => [...prev, asistanMesaji])
    } catch (err) {
      const hataMesaji = {
        id: Date.now() + 1,
        kimden: 'asistan',
        metin: `Uzgunum, su an yanit veremiyorum. Hata: ${err.message}`,
        zaman: new Date(),
        hata: true,
      }
      setMesajlar(prev => [...prev, hataMesaji])
    } finally {
      setYukleniyor(false)
    }
  }

  // Enter ile gonder
  const klavyeBasildi = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      mesajGonder()
    }
  }

  // Stiller
  const sayfaStyle = {
    minHeight: 'calc(100vh - 56px)',
    backgroundColor: '#f0f4f8',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
  }

  const konteynerStyle = {
    maxWidth: '760px',
    margin: '0 auto',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  }

  const sohbetAlaniStyle = {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: '16px 16px 0 0',
    padding: '24px',
    overflowY: 'auto',
    maxHeight: 'calc(100vh - 280px)',
    minHeight: '400px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
  }

  const girisBolumStyle = {
    backgroundColor: '#fff',
    borderRadius: '0 0 16px 16px',
    padding: '16px 24px',
    borderTop: '1px solid #e2e8f0',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  }

  const mesajStyle = (kimden, hata) => ({
    display: 'flex',
    flexDirection: kimden === 'kullanici' ? 'row-reverse' : 'row',
    marginBottom: '20px',
    alignItems: 'flex-end',
    gap: '10px',
  })

  const balonStyle = (kimden, hata) => ({
    maxWidth: '75%',
    padding: '14px 18px',
    borderRadius: kimden === 'kullanici'
      ? '18px 18px 4px 18px'
      : '18px 18px 18px 4px',
    backgroundColor: hata
      ? '#fff5f5'
      : kimden === 'kullanici'
      ? '#2b6cb0'
      : '#f7fafc',
    color: hata
      ? '#c53030'
      : kimden === 'kullanici'
      ? '#fff'
      : '#1a202c',
    fontSize: '15px',
    lineHeight: 1.6,
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    border: hata ? '1px solid #fed7d7' : 'none',
  })

  const avatarStyle = (kimden) => ({
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: kimden === 'kullanici' ? '#2b6cb0' : '#e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '700',
    color: kimden === 'kullanici' ? '#fff' : '#4a5568',
    flexShrink: 0,
  })

  return (
    <div style={sayfaStyle}>
      <div style={konteynerStyle}>
        {/* Baslik */}
        <div style={{ marginBottom: '16px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a202c', marginBottom: '4px' }}>
            Finansal Asistan
          </h1>
          <p style={{ color: '#718096', fontSize: '14px' }}>
            Finansal durumun hakkinda her seyi sorabilirsin.
          </p>
        </div>

        {/* Sohbet alani */}
        <div style={sohbetAlaniStyle}>
          {mesajlar.map((mesaj) => (
            <div key={mesaj.id} style={mesajStyle(mesaj.kimden, mesaj.hata)}>
              <div style={avatarStyle(mesaj.kimden)}>
                {mesaj.kimden === 'kullanici' ? 'S' : 'P'}
              </div>
              <div>
                <div style={balonStyle(mesaj.kimden, mesaj.hata)}>
                  {/* Satir sonlarini koru */}
                  {mesaj.metin.split('\n').map((satir, i) => (
                    <React.Fragment key={i}>
                      {satir}
                      {i < mesaj.metin.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </div>
                <p style={{
                  fontSize: '11px', color: '#a0aec0', marginTop: '4px',
                  textAlign: mesaj.kimden === 'kullanici' ? 'right' : 'left'
                }}>
                  {zamanDuzenle(mesaj.zaman)}
                </p>
              </div>
            </div>
          ))}

          {/* Yaziliyor gostergesi */}
          {yukleniyor && (
            <div style={mesajStyle('asistan', false)}>
              <div style={avatarStyle('asistan')}>P</div>
              <div style={{ ...balonStyle('asistan', false), padding: '16px 20px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        backgroundColor: '#a0aec0',
                        animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={mesajSonuRef} />
        </div>

        {/* Oneri butonlari */}
        <div style={{
          backgroundColor: '#f7fafc',
          borderTop: '1px solid #e2e8f0',
          padding: '12px 24px',
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
        }}>
          {ONERI_MESAJLAR.map((oneri, i) => (
            <button
              key={i}
              onClick={() => mesajGonder(oneri)}
              disabled={yukleniyor}
              style={{
                padding: '6px 14px',
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '20px',
                fontSize: '13px',
                color: '#4a5568',
                cursor: yukleniyor ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
                flexShrink: 0,
              }}
            >
              {oneri}
            </button>
          ))}
        </div>

        {/* Giris alani */}
        <div style={girisBolumStyle}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <textarea
              value={girisMetni}
              onChange={(e) => setGirisMetni(e.target.value)}
              onKeyDown={klavyeBasildi}
              placeholder="Finansal durumun hakkinda bir soru sor... (Enter ile gonder)"
              disabled={yukleniyor}
              style={{
                flex: 1,
                padding: '12px 16px',
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '15px',
                resize: 'none',
                minHeight: '52px',
                maxHeight: '120px',
                fontFamily: 'inherit',
                color: '#1a202c',
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#2b6cb0'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              rows={1}
            />
            <button
              onClick={() => mesajGonder()}
              disabled={!girisMetni.trim() || yukleniyor}
              style={{
                padding: '14px 24px',
                backgroundColor: girisMetni.trim() && !yukleniyor ? '#2b6cb0' : '#a0aec0',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: girisMetni.trim() && !yukleniyor ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                transition: 'background-color 0.15s',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              Gonder
            </button>
          </div>
          <p style={{ fontSize: '11px', color: '#a0aec0', marginTop: '8px', textAlign: 'center' }}>
            ParaPusula AI finansal danismanlik saglar, yatirim tavsiyesi vermez.
          </p>
        </div>
      </div>

      {/* Pulse animasyon icin inline style */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}
