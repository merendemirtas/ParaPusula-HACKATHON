import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { onboarding } from '../services/api.js'

// Onboarding soruları ve seçenekleri
const ADIMLAR = [
  {
    soru: 'Geliriniz nasil bir duzende?',
    alan: 'gelir_duzeni',
    secenekler: [
      { deger: 'sabit_maas', etiket: 'Sabit Maas', aciklama: 'Her ay belirli bir tarihte maas aliyorum' },
      { deger: 'degisken', etiket: 'Degisken', aciklama: 'Serbest meslek, freelance veya komisyon bazli' },
      { deger: 'ikisi_de', etiket: 'Ikisi de', aciklama: 'Hem sabit hem ek gelir kaynagim var' },
    ],
  },
  {
    soru: 'Sunki finansal tablonuz nasildir?',
    alan: 'mevcut_durum',
    secenekler: [
      { deger: 'ay_sonu_bitiyor', etiket: 'Ay sonu para bitiyor', aciklama: 'Maasi zor yetistiriyorum, ay sonu daraliyor' },
      { deger: 'idare_ediyorum', etiket: 'Idare ediyorum', aciklama: 'Cikiyorum ama fazlasi kalmiyor' },
      { deger: 'duzenli_kaliyor', etiket: 'Duzenli para kaliyor', aciklama: 'Her ay bir miktar artirabiliyorum' },
    ],
  },
  {
    soru: 'En onemli finansal hedefiniz nedir?',
    alan: 'ana_hedef',
    secenekler: [
      { deger: 'borctan_kurtulmak', etiket: 'Borctan kurtulmak', aciklama: 'Kredi kartlari, krediler, taksitler bitiyor' },
      { deger: 'hedefe_birikim', etiket: 'Hedefe birikim yapmak', aciklama: 'Ev, araba, tatil veya emeklilik icin biriktiriyorum' },
      { deger: 'harcamalari_anlamak', etiket: 'Harcamayi anlamak', aciklama: 'Param nereye gidiyor bilmek istiyorum' },
    ],
  },
  {
    soru: 'Harcama aliskanliginizi nasil tanimlarsiniz?',
    alan: 'harcama_aliskanligi',
    secenekler: [
      { deger: 'durtüsel', etiket: 'Durtüsel', aciklama: 'Anlinda karar veririm, plan yapmam zor' },
      { deger: 'planli_ama_kayiyor', etiket: 'Planli ama kayiyor', aciklama: 'Butce yapiyorum ama tutturamiyorum' },
      { deger: 'cok_tutumlu', etiket: 'Cok tutumlu', aciklama: 'Her kurusu hesap ediyorum, tasarruf benim icin onemli' },
    ],
  },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const [adim, setAdim] = useState(0)
  const [yanıtlar, setYanıtlar] = useState({})
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState('')

  const mevcutAdim = ADIMLAR[adim]
  const toplamAdim = ADIMLAR.length
  const ilerleme = ((adim) / toplamAdim) * 100

  // Bir secenek secildiginde
  const secenekSec = async (alan, deger) => {
    const yeniYanıtlar = { ...yanıtlar, [alan]: deger }
    setYanıtlar(yeniYanıtlar)

    // Son adim ise formu gonder
    if (adim === toplamAdim - 1) {
      await formGonder(yeniYanıtlar)
    } else {
      // Kisa gecis animasyonu ile bir sonraki adima gec
      setTimeout(() => setAdim(adim + 1), 200)
    }
  }

  // Formu API'ye gonder
  const formGonder = async (tümYanıtlar) => {
    setYukleniyor(true)
    setHata('')

    try {
      // Benzersiz user_id olustur
      const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

      const istek = {
        user_id: userId,
        gelir_duzeni: tümYanıtlar.gelir_duzeni,
        mevcut_durum: tümYanıtlar.mevcut_durum,
        ana_hedef: tümYanıtlar.ana_hedef,
        harcama_aliskanligi: tümYanıtlar.harcama_aliskanligi,
      }

      await onboarding(istek)

      // user_id'yi localStorage'a kaydet
      localStorage.setItem('parapusula_user_id', userId)

      // Dashboard'a yonlendir
      navigate('/dashboard')
    } catch (err) {
      setHata(err.message || 'Bir hata olustu. Lutfen tekrar deneyin.')
      setYukleniyor(false)
    }
  }

  // Stiller
  const sayfaStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1a365d 0%, #2b6cb0 50%, #1a365d 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  }

  const kartStyle = {
    backgroundColor: '#fff',
    borderRadius: '20px',
    padding: '48px',
    maxWidth: '560px',
    width: '100%',
    boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
  }

  const baslikStyle = {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: '8px',
    lineHeight: 1.3,
  }

  const altBaslikStyle = {
    fontSize: '14px',
    color: '#718096',
    marginBottom: '32px',
  }

  const secenekStyle = (secili) => ({
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '16px 20px',
    marginBottom: '12px',
    border: `2px solid ${secili ? '#2b6cb0' : '#e2e8f0'}`,
    borderRadius: '12px',
    backgroundColor: secili ? '#ebf8ff' : '#fff',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  })

  const secenekBaslikStyle = {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a202c',
    display: 'block',
    marginBottom: '4px',
  }

  const secenekAciklamaStyle = {
    fontSize: '13px',
    color: '#718096',
    display: 'block',
  }

  const ilerlemeKonteynerStyle = {
    marginBottom: '36px',
  }

  const ilerlemeCubukStyle = {
    height: '6px',
    backgroundColor: '#e2e8f0',
    borderRadius: '3px',
    overflow: 'hidden',
    marginTop: '8px',
  }

  const ilerlemeDolguStyle = {
    height: '100%',
    backgroundColor: '#2b6cb0',
    borderRadius: '3px',
    width: `${ilerleme}%`,
    transition: 'width 0.3s ease',
  }

  if (yukleniyor) {
    return (
      <div style={sayfaStyle}>
        <div style={{ ...kartStyle, textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '24px' }}>...</div>
          <h2 style={{ color: '#2b6cb0', marginBottom: '8px' }}>Profiliniz olusturuluyor</h2>
          <p style={{ color: '#718096' }}>Bir moment, finansal yolculugunuza hazirlaniyor</p>
        </div>
      </div>
    )
  }

  return (
    <div style={sayfaStyle}>
      <div style={kartStyle}>
        {/* Logo ve baslik */}
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#1a365d', marginBottom: '4px' }}>
            ParaPusula
          </div>
          <div style={{ fontSize: '14px', color: '#718096' }}>
            AI destekli kisisel finans analizi
          </div>
        </div>

        {/* Ilerleme cubugu */}
        <div style={ilerlemeKonteynerStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#718096' }}>
            <span>Adim {adim + 1} / {toplamAdim}</span>
            <span>%{Math.round(((adim + 1) / toplamAdim) * 100)}</span>
          </div>
          <div style={ilerlemeCubukStyle}>
            <div style={{ ...ilerlemeDolguStyle, width: `${((adim + 1) / toplamAdim) * 100}%` }} />
          </div>
        </div>

        {/* Soru */}
        <h2 style={baslikStyle}>{mevcutAdim.soru}</h2>
        <p style={altBaslikStyle}>Size en uygun secenegi seçin</p>

        {/* Secenekler */}
        {mevcutAdim.secenekler.map((secenek) => {
          const secili = yanıtlar[mevcutAdim.alan] === secenek.deger
          return (
            <button
              key={secenek.deger}
              style={secenekStyle(secili)}
              onClick={() => secenekSec(mevcutAdim.alan, secenek.deger)}
              onMouseEnter={(e) => {
                if (!secili) e.currentTarget.style.borderColor = '#90cdf4'
              }}
              onMouseLeave={(e) => {
                if (!secili) e.currentTarget.style.borderColor = '#e2e8f0'
              }}
            >
              <span style={secenekBaslikStyle}>{secenek.etiket}</span>
              <span style={secenekAciklamaStyle}>{secenek.aciklama}</span>
            </button>
          )
        })}

        {/* Geri butonu */}
        {adim > 0 && (
          <button
            style={{
              background: 'none',
              border: 'none',
              color: '#718096',
              cursor: 'pointer',
              fontSize: '14px',
              marginTop: '16px',
              padding: '8px',
              fontFamily: 'inherit',
            }}
            onClick={() => setAdim(adim - 1)}
          >
            Geri don
          </button>
        )}

        {/* Hata mesaji */}
        {hata && (
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            backgroundColor: '#fff5f5',
            border: '1px solid #fed7d7',
            borderRadius: '8px',
            color: '#c53030',
            fontSize: '14px',
          }}>
            {hata}
          </div>
        )}
      </div>
    </div>
  )
}
