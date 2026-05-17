import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAnalysis } from '../services/api.js'

// Para formatlama
const paraDuzenle = (sayi) => {
  if (!sayi && sayi !== 0) return '0 TL'
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(sayi)) + ' TL'
}

// Siniflandirma renkler ve etiketler
const SINIF = {
  stratejik: { renk: '#38a169', arkaplan: '#f0fff4', etiket: 'Stratejik', aciklama: 'Deger yaratan borç' },
  gri: { renk: '#d69e2e', arkaplan: '#fffff0', etiket: 'Gri Alan', aciklama: 'Orta vadeli, izlenmeli' },
  kotu: { renk: '#e53e3e', arkaplan: '#fff5f5', etiket: 'Riskli', aciklama: 'Yuksek faizli, oncelikli ode' },
}

export default function DebtMap() {
  const navigate = useNavigate()
  const userId = localStorage.getItem('parapusula_user_id') || ''

  const [analiz, setAnaliz] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState('')

  useEffect(() => {
    analizGetir()
  }, [userId])

  const analizGetir = async () => {
    if (!userId) return
    setYukleniyor(true)
    try {
      const veri = await getAnalysis(userId)
      setAnaliz(veri)
    } catch (err) {
      if (err.message?.includes('404')) {
        setHata('yok')
      } else {
        setHata(err.message || 'Veri yuklenemedi.')
      }
    } finally {
      setYukleniyor(false)
    }
  }

  const sayfaStyle = {
    minHeight: 'calc(100vh - 56px)',
    backgroundColor: '#f0f4f8',
    padding: '32px 24px',
  }

  const konteynerStyle = {
    maxWidth: '900px',
    margin: '0 auto',
  }

  if (yukleniyor) {
    return (
      <div style={sayfaStyle}>
        <div style={{ ...konteynerStyle, textAlign: 'center', paddingTop: '80px' }}>
          <p style={{ color: '#718096', fontSize: '18px' }}>Borc haritasi yukleniyor...</p>
        </div>
      </div>
    )
  }

  if (hata === 'yok' || !analiz) {
    return (
      <div style={sayfaStyle}>
        <div style={{ ...konteynerStyle, textAlign: 'center', paddingTop: '80px' }}>
          <h2 style={{ color: '#1a202c', marginBottom: '12px' }}>Henuz analiz bulunamadi</h2>
          <p style={{ color: '#718096', marginBottom: '24px' }}>
            Borc haritasini gormek icin banka ekstreni yukle.
          </p>
          <button onClick={() => navigate('/upload')} style={{
            padding: '14px 32px', backgroundColor: '#2b6cb0', color: '#fff',
            border: 'none', borderRadius: '10px', fontSize: '16px', cursor: 'pointer', fontFamily: 'inherit'
          }}>
            PDF Yukle
          </button>
        </div>
      </div>
    )
  }

  const borcListesi = analiz.borc_listesi || []
  const borcCikisPlan = analiz.borc_cikis_plani

  const toplamBorc = borcListesi.reduce((t, b) => t + (b.ana_para || 0), 0)
  const aylikToplamOdeme = borcListesi.reduce((t, b) => t + (b.aylik_odeme || 0), 0)

  return (
    <div style={sayfaStyle}>
      <div style={konteynerStyle}>
        {/* Baslik */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1a202c', marginBottom: '4px' }}>
            Borc Haritam
          </h1>
          <p style={{ color: '#718096', fontSize: '14px' }}>
            Borclarini siniflandir, en iyi odeme stratejisini bul.
          </p>
        </div>

        {/* Ozet kartlar */}
        {borcListesi.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '4px solid #e53e3e' }}>
              <p style={{ fontSize: '12px', color: '#718096', fontWeight: '600', marginBottom: '8px' }}>TOPLAM BORC</p>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#e53e3e' }}>{paraDuzenle(toplamBorc)}</div>
            </div>
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '4px solid #d69e2e' }}>
              <p style={{ fontSize: '12px', color: '#718096', fontWeight: '600', marginBottom: '8px' }}>AYLIK ODEME</p>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#d69e2e' }}>{paraDuzenle(aylikToplamOdeme)}</div>
            </div>
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '4px solid #2b6cb0' }}>
              <p style={{ fontSize: '12px', color: '#718096', fontWeight: '600', marginBottom: '8px' }}>BORC SAYISI</p>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#2b6cb0' }}>{borcListesi.length} adet</div>
            </div>
          </div>
        )}

        {/* Borc yoksa */}
        {borcListesi.length === 0 && (
          <div style={{
            backgroundColor: '#fff', borderRadius: '14px', padding: '48px',
            textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: '24px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
            <h2 style={{ color: '#38a169', marginBottom: '8px' }}>Borc tespit edilmedi!</h2>
            <p style={{ color: '#718096' }}>Analize gore aktif borc ya da taksit odemeniz bulunmuyor.</p>
          </div>
        )}

        {/* Borc kartlari */}
        {borcListesi.map((borc, i) => {
          const sinif = SINIF[borc.siniflandirma] || SINIF.gri
          const odenmislik = borc.kalan_taksit > 0
            ? Math.max(0, 100 - (borc.kalan_taksit / (borc.kalan_taksit + 6)) * 100)
            : 0

          return (
            <div
              key={i}
              style={{
                backgroundColor: sinif.arkaplan,
                border: `1px solid ${sinif.renk}30`,
                borderRadius: '14px',
                padding: '24px',
                marginBottom: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}
            >
              {/* Borc basligi */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1a202c' }}>
                  {borc.aciklama}
                </h3>
                <span style={{
                  padding: '4px 14px',
                  borderRadius: '20px',
                  backgroundColor: sinif.renk,
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: '600',
                }}>
                  {sinif.etiket}
                </span>
              </div>

              <p style={{ fontSize: '13px', color: '#718096', marginBottom: '16px' }}>
                {sinif.aciklama}
              </p>

              {/* Borc detaylari */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>Ana Para</p>
                  <p style={{ fontSize: '18px', fontWeight: '700', color: '#1a202c' }}>
                    {paraDuzenle(borc.ana_para)}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>Aylik Odeme</p>
                  <p style={{ fontSize: '18px', fontWeight: '700', color: '#1a202c' }}>
                    {paraDuzenle(borc.aylik_odeme)}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>Faiz Orani</p>
                  <p style={{ fontSize: '18px', fontWeight: '700', color: '#1a202c' }}>
                    %{borc.faiz_orani?.toFixed(2) || '0'} yillik
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>Kalan Taksit</p>
                  <p style={{ fontSize: '18px', fontWeight: '700', color: '#1a202c' }}>
                    {borc.kalan_taksit} ay
                  </p>
                </div>
              </div>

              {/* Ilerleme cubugu */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#718096', marginBottom: '6px' }}>
                  <span>Odeme Ilerlemesi</span>
                  <span>%{odenmislik.toFixed(0)}</span>
                </div>
                <div style={{ height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${odenmislik}%`,
                    backgroundColor: sinif.renk,
                    borderRadius: '3px',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            </div>
          )
        })}

        {/* Borc Cikis Plani */}
        {borcCikisPlan && (
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '14px',
            padding: '28px',
            marginTop: '24px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
            borderTop: '4px solid #2b6cb0',
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1a202c', marginBottom: '8px' }}>
              Borc Cikis Plani
            </h2>
            <p style={{ color: '#718096', fontSize: '14px', marginBottom: '20px' }}>
              Yontem: <strong style={{ color: '#2b6cb0', textTransform: 'capitalize' }}>
                {borcCikisPlan.yontem === 'avalanche' ? 'Avalanche (Yuksek faizden baslayarak)' : 'Snowball (Kucukten buyuge)'}
              </strong>
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div style={{ padding: '16px', backgroundColor: '#f7fafc', borderRadius: '10px' }}>
                <p style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>Toplam Borc</p>
                <p style={{ fontWeight: '700', color: '#1a202c' }}>{paraDuzenle(borcCikisPlan.toplam_borc)}</p>
              </div>
              <div style={{ padding: '16px', backgroundColor: '#f7fafc', borderRadius: '10px' }}>
                <p style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>Aylik Ekstra Odeme</p>
                <p style={{ fontWeight: '700', color: '#1a202c' }}>{paraDuzenle(borcCikisPlan.aylik_ekstra_odeme)}</p>
              </div>
              <div style={{ padding: '16px', backgroundColor: '#f0fff4', borderRadius: '10px' }}>
                <p style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>Tahmini Bitis</p>
                <p style={{ fontWeight: '700', color: '#38a169' }}>{borcCikisPlan.tahmini_bitis_ay}</p>
              </div>
            </div>

            {/* Adimlar */}
            {borcCikisPlan.adimlar && borcCikisPlan.adimlar.length > 0 && (
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px', color: '#4a5568' }}>
                  Odeme Plani (Ilk Adimlar)
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#718096', fontWeight: '600' }}>Ay</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#718096', fontWeight: '600' }}>Borc</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', color: '#718096', fontWeight: '600' }}>Odeme</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', color: '#718096', fontWeight: '600' }}>Kalan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {borcCikisPlan.adimlar.slice(0, 6).map((adim, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '10px 12px', color: '#4a5568' }}>{adim.ay}</td>
                          <td style={{ padding: '10px 12px', color: '#1a202c', fontWeight: '500' }}>{adim.borc_adi}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#2b6cb0', fontWeight: '600' }}>{paraDuzenle(adim.odeme)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#718096' }}>{paraDuzenle(adim.kalan)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
