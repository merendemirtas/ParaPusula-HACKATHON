import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'
import { getAnalysis } from '../services/api.js'

const RENKLER = [
  '#2b6cb0', '#38a169', '#d69e2e', '#e53e3e',
  '#805ad5', '#dd6b20', '#319795', '#e91e63',
  '#00bcd4', '#ff5722',
]

const paraDuzenle = (sayi) => {
  if (!sayi && sayi !== 0) return '0 TL'
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(sayi)) + ' TL'
}

const tarihDuzenle = (tarih) => {
  if (!tarih) return ''
  try {
    return new Date(tarih).toLocaleDateString('tr-TR', {
      day: '2-digit', month: 'short'
    })
  } catch {
    return tarih
  }
}

export default function Expenses() {
  const navigate = useNavigate()
  const userId = localStorage.getItem('parapusula_user_id') || ''

  const [analiz, setAnaliz] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [secilenKategori, setSecilenKategori] = useState(null)
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
    maxWidth: '1000px',
    margin: '0 auto',
  }

  if (yukleniyor) {
    return (
      <div style={sayfaStyle}>
        <div style={{ ...konteynerStyle, textAlign: 'center', paddingTop: '80px' }}>
          <p style={{ color: '#718096', fontSize: '18px' }}>Harcamalar yukleniyor...</p>
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
            Harcama analizini gormek icin banka ekstreni yukle.
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

  // Sadece gider kategorileri
  const giderKategorileri = (analiz.kategoriler || [])
    .filter(k => k.toplam_tutar < 0)
    .map((k, i) => ({
      ...k,
      renk: RENKLER[i % RENKLER.length],
      tutar: Math.abs(k.toplam_tutar),
    }))
    .sort((a, b) => b.tutar - a.tutar)

  // Bar grafik verisi
  const grafikVerisi = giderKategorileri.slice(0, 10).map(k => ({
    name: k.kategori_adi.length > 14 ? k.kategori_adi.slice(0, 14) + '...' : k.kategori_adi,
    tamIsim: k.kategori_adi,
    tutar: k.tutar,
    renk: k.renk,
  }))

  // Secilen kategori
  const secilenKategoriDetay = secilenKategori
    ? giderKategorileri.find(k => k.kategori_adi === secilenKategori)
    : null

  return (
    <div style={sayfaStyle}>
      <div style={konteynerStyle}>
        {/* Baslik */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1a202c', marginBottom: '4px' }}>
            Harcamalarim
          </h1>
          <p style={{ color: '#718096', fontSize: '14px' }}>
            Kategoriye tikla, detayli islemleri gor.
          </p>
        </div>

        {/* Bar Grafik */}
        <div style={{
          backgroundColor: '#fff', borderRadius: '14px', padding: '24px',
          marginBottom: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1a202c', marginBottom: '20px' }}>
            Kategoriye Gore Harcamalar
          </h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={grafikVerisi} margin={{ top: 5, right: 20, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#718096' }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                tick={{ fontSize: 12, fill: '#718096' }}
              />
              <Tooltip
                formatter={(value, _, props) => [
                  paraDuzenle(value),
                  props.payload?.tamIsim || 'Tutar'
                ]}
                labelFormatter={(label) => label}
              />
              <Bar
                dataKey="tutar"
                radius={[6, 6, 0, 0]}
                cursor="pointer"
                onClick={(data) => setSecilenKategori(data.tamIsim)}
              >
                {grafikVerisi.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={secilenKategori === entry.tamIsim ? '#1a365d' : entry.renk}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p style={{ fontSize: '12px', color: '#a0aec0', textAlign: 'center', marginTop: '8px' }}>
            Bir cubuga tiklayarak o kategorinin islemlerini inceleyin
          </p>
        </div>

        {/* Kategori Listesi */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {giderKategorileri.map((k, i) => (
            <button
              key={i}
              onClick={() => setSecilenKategori(secilenKategori === k.kategori_adi ? null : k.kategori_adi)}
              style={{
                padding: '16px',
                backgroundColor: secilenKategori === k.kategori_adi ? k.renk : '#fff',
                border: `2px solid ${k.renk}`,
                borderRadius: '10px',
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              <p style={{
                fontSize: '13px', fontWeight: '600', marginBottom: '4px',
                color: secilenKategori === k.kategori_adi ? '#fff' : '#1a202c'
              }}>
                {k.kategori_adi}
                {k.abonelik_mi && (
                  <span style={{ marginLeft: '6px', fontSize: '11px', opacity: 0.8 }}>
                    [Abonelik]
                  </span>
                )}
              </p>
              <p style={{
                fontSize: '16px', fontWeight: '700',
                color: secilenKategori === k.kategori_adi ? '#fff' : k.renk
              }}>
                {paraDuzenle(k.tutar)}
              </p>
              <p style={{
                fontSize: '11px',
                color: secilenKategori === k.kategori_adi ? 'rgba(255,255,255,0.8)' : '#718096'
              }}>
                {k.islem_sayisi} islem
              </p>
            </button>
          ))}
        </div>

        {/* Secilen kategorinin islemleri */}
        {secilenKategoriDetay && (
          <div style={{
            backgroundColor: '#fff', borderRadius: '14px', padding: '24px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
            borderTop: `4px solid ${secilenKategoriDetay.renk}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1a202c' }}>
                {secilenKategoriDetay.kategori_adi}
              </h2>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <span style={{ fontSize: '20px', fontWeight: '700', color: secilenKategoriDetay.renk }}>
                  {paraDuzenle(secilenKategoriDetay.tutar)}
                </span>
                <button
                  onClick={() => setSecilenKategori(null)}
                  style={{
                    padding: '6px 14px', backgroundColor: '#f7fafc', border: '1px solid #e2e8f0',
                    borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', color: '#718096'
                  }}
                >
                  Kapat
                </button>
              </div>
            </div>

            {/* Islem tablosu */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#718096', fontWeight: '600' }}>Tarih</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#718096', fontWeight: '600' }}>Aciklama</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#718096', fontWeight: '600' }}>Banka</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', color: '#718096', fontWeight: '600' }}>Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {(secilenKategoriDetay.islemler || []).map((islem, i) => (
                    <tr
                      key={i}
                      style={{
                        borderBottom: '1px solid #f0f4f8',
                        backgroundColor: i % 2 === 0 ? '#fff' : '#f7fafc'
                      }}
                    >
                      <td style={{ padding: '12px', color: '#718096', whiteSpace: 'nowrap' }}>
                        {tarihDuzenle(islem.tarih)}
                      </td>
                      <td style={{ padding: '12px', color: '#1a202c' }}>
                        {islem.aciklama}
                      </td>
                      <td style={{ padding: '12px', color: '#718096' }}>
                        {islem.banka}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: islem.tur === 'gelir' ? '#38a169' : '#e53e3e' }}>
                        {islem.tur === 'gelir' ? '+' : '-'}{paraDuzenle(islem.tutar)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
