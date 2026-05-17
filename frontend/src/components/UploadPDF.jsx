import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadPDF } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function UploadPDF() {
  const navigate = useNavigate()
  const { kullanici } = useAuth()
  // Firebase Auth uid'sini kullan — localStorage'a bağımlılığı kaldır
  const userId = kullanici?.uid || ''
  const dosyaInputRef = useRef(null)

  const [secilenDosya, setSecilenDosya] = useState(null)
  const [secilenBanka, setSecilenBanka] = useState('Ziraat')
  const [durum, setDurum] = useState('bekliyor') // bekliyor | yukleniyor | tamamlandi | hata
  const [surukle, setSurukle] = useState(false)
  const [hata, setHata] = useState('')
  const [ilerleme, setIlerleme] = useState(0)

  // Dosya secimi (input)
  const dosyaSec = (e) => {
    const dosya = e.target.files?.[0]
    if (dosya) dogrulaVeAyarla(dosya)
  }

  // Drag & drop islemleri
  const surukleUzerine = (e) => {
    e.preventDefault()
    setSurukle(true)
  }

  const surukleAyril = (e) => {
    e.preventDefault()
    setSurukle(false)
  }

  const birak = (e) => {
    e.preventDefault()
    setSurukle(false)
    const dosya = e.dataTransfer.files?.[0]
    if (dosya) dogrulaVeAyarla(dosya)
  }

  // Dosya dogrulama
  const dogrulaVeAyarla = (dosya) => {
    setHata('')
    if (!dosya.name.toLowerCase().endsWith('.pdf')) {
      setHata('Yalnizca PDF dosyasi yukleyebilirsiniz.')
      return
    }
    if (dosya.size > 10 * 1024 * 1024) {
      setHata('Dosya boyutu 10 MB\'dan kucuk olmalidir.')
      return
    }
    setSecilenDosya(dosya)
  }

  // Yukleme baslat
  const yukle = async () => {
    if (!secilenDosya) {
      setHata('Lutfen bir PDF dosyasi secin.')
      return
    }
    if (!userId) {
      setHata('Oturum bilgisi bulunamadi. Lutfen sayfayi yenileyin.')
      return
    }

    setDurum('yukleniyor')
    setHata('')

    // Sahte ilerleme animasyonu
    const ilerlemeArttir = setInterval(() => {
      setIlerleme(prev => prev < 85 ? prev + 5 : prev)
    }, 300)

    try {
      await uploadPDF(secilenDosya, userId, secilenBanka)

      clearInterval(ilerlemeArttir)
      setIlerleme(100)
      setDurum('tamamlandi')

      // 2 saniye sonra dashboard'a yonlendir
      setTimeout(() => navigate('/dashboard'), 2000)
    } catch (err) {
      clearInterval(ilerlemeArttir)
      setIlerleme(0)
      setDurum('hata')
      setHata(err.message || 'Yukleme sirasinda hata olustu.')
    }
  }

  // Yeniden deneme
  const yenidenDene = () => {
    setDurum('bekliyor')
    setSecilenDosya(null)
    setIlerleme(0)
    setHata('')
  }

  // Stiller
  const sayfaStyle = {
    minHeight: 'calc(100vh - 56px)',
    backgroundColor: '#f0f4f8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  }

  const kartStyle = {
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '48px',
    maxWidth: '560px',
    width: '100%',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  }

  const surukleAlanStyle = {
    border: `2px dashed ${surukle ? '#2b6cb0' : '#cbd5e0'}`,
    borderRadius: '12px',
    padding: '48px 24px',
    textAlign: 'center',
    cursor: 'pointer',
    backgroundColor: surukle ? '#ebf8ff' : '#f7fafc',
    transition: 'all 0.2s',
    marginBottom: '24px',
  }

  if (durum === 'tamamlandi') {
    return (
      <div style={sayfaStyle}>
        <div style={{ ...kartStyle, textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px', color: '#38a169' }}>✓</div>
          <h2 style={{ color: '#1a202c', marginBottom: '8px', fontSize: '24px' }}>
            PDF yuklendi!
          </h2>
          <p style={{ color: '#718096', marginBottom: '24px' }}>
            Banka ekstresi alindi. Analiz arka planda devam ediyor.
            <br />
            Dashboard'a yonlendiriliyorsunuz...
          </p>
          <div style={{ height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px' }}>
            <div style={{ height: '100%', width: '100%', backgroundColor: '#38a169', borderRadius: '2px' }} />
          </div>
        </div>
      </div>
    )
  }

  if (durum === 'yukleniyor') {
    return (
      <div style={sayfaStyle}>
        <div style={{ ...kartStyle, textAlign: 'center' }}>
          <h2 style={{ color: '#1a202c', marginBottom: '8px', fontSize: '24px' }}>
            Isleniyor...
          </h2>
          <p style={{ color: '#718096', marginBottom: '32px' }}>
            {secilenDosya?.name} yukleniyor ve analiz baslatiliyor.
          </p>
          <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${ilerleme}%`,
              backgroundColor: '#2b6cb0',
              borderRadius: '4px',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <p style={{ color: '#718096', fontSize: '13px', marginTop: '12px' }}>
            %{ilerleme} tamamlandi
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={sayfaStyle}>
      <div style={kartStyle}>
        <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#1a202c', marginBottom: '8px' }}>
          Banka Ekstresi Yukle
        </h1>
        <p style={{ color: '#718096', marginBottom: '32px', fontSize: '15px' }}>
          PDF formatindaki banka ekstreni yukle, AI ile analiz baslayacak.
        </p>

        {/* Banka secimi */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#4a5568', marginBottom: '12px' }}>
            Bankanizi secin
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            {['Ziraat', 'Halkbank'].map((banka) => (
              <button
                key={banka}
                onClick={() => setSecilenBanka(banka)}
                style={{
                  flex: 1,
                  padding: '14px',
                  border: `2px solid ${secilenBanka === banka ? '#2b6cb0' : '#e2e8f0'}`,
                  borderRadius: '10px',
                  backgroundColor: secilenBanka === banka ? '#ebf8ff' : '#fff',
                  color: secilenBanka === banka ? '#2b6cb0' : '#4a5568',
                  fontWeight: '600',
                  fontSize: '15px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {banka}
              </button>
            ))}
          </div>
        </div>

        {/* Drag & Drop alani */}
        <div
          style={surukleAlanStyle}
          onDragOver={surukleUzerine}
          onDragLeave={surukleAyril}
          onDrop={birak}
          onClick={() => dosyaInputRef.current?.click()}
        >
          <div style={{ fontSize: '40px', marginBottom: '12px', color: '#a0aec0' }}>
            PDF
          </div>
          {secilenDosya ? (
            <>
              <p style={{ fontWeight: '600', color: '#2b6cb0', marginBottom: '4px' }}>
                {secilenDosya.name}
              </p>
              <p style={{ color: '#718096', fontSize: '13px' }}>
                {(secilenDosya.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </>
          ) : (
            <>
              <p style={{ fontWeight: '600', color: '#4a5568', marginBottom: '4px' }}>
                PDF surukle birak veya tikla
              </p>
              <p style={{ color: '#718096', fontSize: '13px' }}>
                Maksimum 10 MB, yalnizca PDF
              </p>
            </>
          )}
        </div>

        <input
          ref={dosyaInputRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={dosyaSec}
        />

        {/* Hata mesaji */}
        {hata && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#fff5f5',
            border: '1px solid #fed7d7',
            borderRadius: '8px',
            color: '#c53030',
            fontSize: '14px',
            marginBottom: '16px',
          }}>
            {hata}
          </div>
        )}

        {/* Yukle butonu */}
        <button
          onClick={yukle}
          disabled={!secilenDosya}
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: secilenDosya ? '#2b6cb0' : '#a0aec0',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: secilenDosya ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            if (secilenDosya) e.currentTarget.style.backgroundColor = '#2c5282'
          }}
          onMouseLeave={(e) => {
            if (secilenDosya) e.currentTarget.style.backgroundColor = '#2b6cb0'
          }}
        >
          {secilenDosya ? `${secilenBanka} Ekstresini Analiz Et` : 'Oncelikle Bir PDF Secin'}
        </button>

        {durum === 'hata' && (
          <button
            onClick={yenidenDene}
            style={{
              width: '100%',
              marginTop: '12px',
              padding: '12px',
              backgroundColor: 'transparent',
              color: '#2b6cb0',
              border: '1px solid #2b6cb0',
              borderRadius: '10px',
              fontSize: '14px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Yeniden Dene
          </button>
        )}

        <p style={{ color: '#a0aec0', fontSize: '12px', textAlign: 'center', marginTop: '16px' }}>
          Verileriniz guvenli sekilde islenir ve saklanir.
        </p>
      </div>
    </div>
  )
}
