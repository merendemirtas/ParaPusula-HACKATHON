import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { getAnalysis, recalculate } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'

// Pasta grafik renk paleti
const RENKLER = [
  '#2b6cb0', '#38a169', '#d69e2e', '#e53e3e',
  '#805ad5', '#dd6b20', '#319795', '#e91e63',
  '#00bcd4', '#ff5722', '#607d8b', '#9c27b0',
]

// Sayiyi para formatina cevir
const paraDuzenle = (sayi) => {
  if (!sayi && sayi !== 0) return '0 TL'
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(sayi)) + ' TL'
}

// Skor rengini belirle (0-40 Kritik, 41-60 Dikkat, 61-80 İyi, 81-100 Mükemmel)
const skorRengi = (skor) => {
  if (skor >= 81) return '#38a169'
  if (skor >= 61) return '#d69e2e'
  if (skor >= 41) return '#dd6b20'
  return '#e53e3e'
}

// Skor etiketi
const skorEtiketi = (skor) => {
  if (skor >= 81) return 'Mükemmel'
  if (skor >= 61) return 'İyi'
  if (skor >= 41) return 'Dikkat'
  return 'Kritik'
}

// Skor yorumu
const skorYorumu = (skor) => {
  if (skor >= 81) return 'Mükemmel finansal sağlık!'
  if (skor >= 61) return 'İyi gidiyorsunuz, geliştirme var.'
  if (skor >= 41) return 'Dikkat edilmesi gereken noktalar var.'
  return 'Acil aksiyon gerekiyor!'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { kullanici } = useAuth()
  const userId = kullanici?.uid || localStorage.getItem('parapusula_user_id') || ''

  const [analiz, setAnaliz] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState('')
  const [hesaplaniyor, setHesaplaniyor] = useState(false)

  useEffect(() => {
    analizGetir()
  }, [userId])

  const analizGetir = async () => {
    if (!userId) return
    setYukleniyor(true)
    setHata('')
    try {
      const veri = await getAnalysis(userId)
      setAnaliz(veri)
    } catch (err) {
      // 404 = henuz analiz yok
      if (err.message && err.message.includes('404')) {
        setHata('yok')
      } else {
        setHata(err.message || 'Analiz yukleniyor, lutfen bekleyin.')
      }
    } finally {
      setYukleniyor(false)
    }
  }

  // Yenile butonu
  const yenile = () => {
    setYukleniyor(true)
    setTimeout(analizGetir, 1000)
  }

  // Skoru ve önerileri yeniden hesapla (PDF gerektirmez)
  const yenidenHesapla = async () => {
    if (!userId || hesaplaniyor) return
    setHesaplaniyor(true)
    try {
      await recalculate(userId)
      await analizGetir()
    } catch (err) {
      console.error('Yeniden hesaplama hatası:', err)
    } finally {
      setHesaplaniyor(false)
    }
  }

  // Stiller
  const sayfaStyle = {
    minHeight: 'calc(100vh - 56px)',
    backgroundColor: '#f0f4f8',
    padding: '32px 24px',
  }

  const konteynerStyle = {
    maxWidth: '1100px',
    margin: '0 auto',
  }

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px',
    marginBottom: '24px',
  }

  const kartStyle = {
    backgroundColor: '#fff',
    borderRadius: '14px',
    padding: '24px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
  }

  if (yukleniyor) {
    return (
      <div style={sayfaStyle}>
        <div style={{ ...konteynerStyle, textAlign: 'center', paddingTop: '80px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', color: '#a0aec0' }}>...</div>
          <p style={{ color: '#718096', fontSize: '18px' }}>Finansal analiz yukleniyor...</p>
          <button onClick={yenile} style={{
            marginTop: '24px', padding: '10px 24px', backgroundColor: '#2b6cb0',
            color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit'
          }}>Yenile</button>
        </div>
      </div>
    )
  }

  if (hata === 'yok' || !analiz) {
    return (
      <div style={sayfaStyle}>
        <div style={{ ...konteynerStyle, textAlign: 'center', paddingTop: '80px' }}>
          <h2 style={{ color: '#1a202c', marginBottom: '12px' }}>Henuz analiz bulunamadi</h2>
          <p style={{ color: '#718096', marginBottom: '32px' }}>
            Finansal analizini gormek icin banka ekstreni yukle.
          </p>
          <button
            onClick={() => navigate('/upload')}
            style={{
              padding: '14px 32px', backgroundColor: '#2b6cb0', color: '#fff',
              border: 'none', borderRadius: '10px', fontSize: '16px', cursor: 'pointer', fontFamily: 'inherit'
            }}
          >
            PDF Yukle
          </button>
          {hata && hata !== 'yok' && (
            <p style={{ marginTop: '16px', color: '#e53e3e', fontSize: '14px' }}>{hata}</p>
          )}
        </div>
      </div>
    )
  }

  const skor = analiz.finansal_skor || 0
  const gelir = analiz.gelir || 0
  const gider = analiz.toplam_gider || 0
  const nakitAkisi = analiz.nakit_akisi || 0
  const kategoriler = analiz.kategoriler || []
  const oneriler = analiz.oneriler || []

  // Pasta grafik verisi (sadece gider kategorileri)
  const grafikVerisi = kategoriler
    .filter(k => k.toplam_tutar < 0 && Math.abs(k.toplam_tutar) > 0)
    .map(k => ({
      name: k.kategori_adi,
      value: Math.abs(k.toplam_tutar),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  return (
    <div style={sayfaStyle}>
      <div style={konteynerStyle}>
        {/* Baslik */}
        <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1a202c', marginBottom: '4px' }}>
              Finansal Panom
            </h1>
            <p style={{ color: '#718096', fontSize: '14px' }}>
              {analiz.ay || 'Bu ay'} donemi analizi
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={yenile} style={{
              padding: '8px 20px', backgroundColor: '#ebf8ff', color: '#2b6cb0',
              border: '1px solid #bee3f8', borderRadius: '8px', cursor: 'pointer',
              fontSize: '14px', fontFamily: 'inherit'
            }}>
              Yenile
            </button>
            <button
              onClick={yenidenHesapla}
              disabled={hesaplaniyor}
              title="Skoru ve önerileri yeniden hesapla (PDF gerektirmez)"
              style={{
                padding: '8px 20px',
                backgroundColor: hesaplaniyor ? '#e2e8f0' : '#2b6cb0',
                color: hesaplaniyor ? '#718096' : '#fff',
                border: 'none', borderRadius: '8px', cursor: hesaplaniyor ? 'wait' : 'pointer',
                fontSize: '14px', fontFamily: 'inherit'
              }}
            >
              {hesaplaniyor ? 'Hesaplanıyor...' : 'Yeniden Hesapla'}
            </button>
          </div>
        </div>

        {/* Usteki metrik kartlari */}
        <div style={gridStyle}>
          {/* Finansal Skor */}
          <div style={{ ...kartStyle, textAlign: 'center', borderTop: `4px solid ${skorRengi(skor)}` }}>
            <p style={{ fontSize: '13px', color: '#718096', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Finansal Sağlık Skoru
            </p>
            <div style={{ fontSize: '72px', fontWeight: '800', color: skorRengi(skor), lineHeight: 1 }}>
              {skor}
            </div>
            <span style={{
              display: 'inline-block', marginTop: '8px', padding: '2px 12px',
              borderRadius: '12px', backgroundColor: skorRengi(skor),
              color: '#fff', fontSize: '12px', fontWeight: '700',
            }}>
              {skorEtiketi(skor)}
            </span>
            <p style={{ fontSize: '13px', color: '#718096', marginTop: '6px' }}>
              {skorYorumu(skor)}
            </p>
          </div>

          {/* Gelir */}
          <div style={{ ...kartStyle, borderTop: '4px solid #38a169' }}>
            <p style={{ fontSize: '13px', color: '#718096', marginBottom: '8px', fontWeight: '600' }}>
              Bu Ay Gelir
            </p>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#38a169' }}>
              {paraDuzenle(gelir)}
            </div>
          </div>

          {/* Gider */}
          <div style={{ ...kartStyle, borderTop: '4px solid #e53e3e' }}>
            <p style={{ fontSize: '13px', color: '#718096', marginBottom: '8px', fontWeight: '600' }}>
              Bu Ay Gider
            </p>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#e53e3e' }}>
              {paraDuzenle(gider)}
            </div>
          </div>

          {/* Nakit Akisi */}
          <div style={{ ...kartStyle, borderTop: `4px solid ${nakitAkisi >= 0 ? '#38a169' : '#e53e3e'}` }}>
            <p style={{ fontSize: '13px', color: '#718096', marginBottom: '8px', fontWeight: '600' }}>
              Nakit Akisi
            </p>
            <div style={{ fontSize: '28px', fontWeight: '700', color: nakitAkisi >= 0 ? '#38a169' : '#e53e3e' }}>
              {nakitAkisi >= 0 ? '+' : ''}{paraDuzenle(nakitAkisi)}
            </div>
            <p style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
              {nakitAkisi >= 0 ? 'Ay sonu artida kapatiyorsunuz' : 'Ay sonu acikta kapatiyorsunuz'}
            </p>
          </div>
        </div>

        {/* Alt kisim: Pasta grafik + Oneriler */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flexWrap: 'wrap' }}>
          {/* Pasta Grafik */}
          {grafikVerisi.length > 0 && (
            <div style={kartStyle}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1a202c', marginBottom: '20px' }}>
                Harcama Dagilimi
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={grafikVerisi}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} %${(percent * 100).toFixed(0)}`}
                    labelLine={true}
                  >
                    {grafikVerisi.map((_, index) => (
                      <Cell key={index} fill={RENKLER[index % RENKLER.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [paraDuzenle(value), 'Tutar']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Oneriler */}
          <div style={kartStyle}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1a202c', marginBottom: '20px' }}>
              Aksiyon Onerileri
            </h2>
            {oneriler.length === 0 ? (
              <p style={{ color: '#718096' }}>Oneriler hesaplaniyor...</p>
            ) : (
              oneriler.slice(0, 3).map((oneri, i) => {
                const oncelikRenk = { 1: '#e53e3e', 2: '#d69e2e', 3: '#38a169' }[oneri.oncelik] || '#718096'
                const oncelikEtiket = { 1: 'Yuksek', 2: 'Orta', 3: 'Dusuk' }[oneri.oncelik] || ''
                return (
                  <div
                    key={i}
                    style={{
                      padding: '16px',
                      borderRadius: '10px',
                      backgroundColor: '#f7fafc',
                      marginBottom: '12px',
                      borderLeft: `4px solid ${oncelikRenk}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#1a202c', flex: 1 }}>
                        {oneri.baslik}
                      </h3>
                      <span style={{
                        fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                        backgroundColor: oncelikRenk, color: '#fff', fontWeight: '600',
                        marginLeft: '8px', whiteSpace: 'nowrap'
                      }}>
                        {oncelikEtiket}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#718096', lineHeight: 1.5 }}>
                      {oneri.aciklama}
                    </p>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
