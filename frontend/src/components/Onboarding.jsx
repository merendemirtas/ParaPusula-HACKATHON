// KARAR: Adımlar arasında otomatik geçiş YOK — kullanıcı kart seçer, "Devam" butonuyla ilerler. Bu daha kontrollü hissettirir.
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { onboarding } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'

const ADIMLAR = [
  {
    soru: 'Gelir düzenin nedir?',
    aciklama: 'Sana özel öneriler için gelir yapını bilelim.',
    alan: 'gelir_duzeni',
    secenekler: [
      { deger: 'sabit_maas', etiket: 'Sabit Maaş', aciklama: 'Her ay aynı tarih ve tutarda maaş alıyorum',
        ikon: <path d="M3 7h18M3 12h18M3 17h12" /> },
      { deger: 'degisken', etiket: 'Değişken Gelir', aciklama: 'Freelance, komisyon veya serbest meslek',
        ikon: <path d="M3 16l5-6 4 4 8-10" /> },
      { deger: 'ikisi_de', etiket: 'İkisi de', aciklama: 'Sabit maaş + ek gelirlerim var',
        ikon: <path d="M12 3v18M3 12h18" /> },
    ],
  },
  {
    soru: 'Şu anki tablon nasıl?',
    aciklama: 'Mevcut durumun startı belirlesin.',
    alan: 'mevcut_durum',
    secenekler: [
      { deger: 'ay_sonu_bitiyor', etiket: 'Ay sonu bitiyor', aciklama: 'Maaş gelmeden cebim boşalıyor',
        ikon: <path d="M12 2v8m0 0l-3-3m3 3l3-3M5 20h14" /> },
      { deger: 'idare_ediyorum', etiket: 'İdare ediyorum', aciklama: 'Çıkıyorum ama biriktiremiyorum',
        ikon: <path d="M3 12h18" /> },
      { deger: 'duzenli_kaliyor', etiket: 'Düzenli kalıyor', aciklama: 'Her ay artırabiliyorum',
        ikon: <path d="M3 17l6-6 4 4 8-8" /> },
    ],
  },
  {
    soru: 'Ana hedefin ne?',
    aciklama: 'Yolculuğun pusulasını birlikte ayarlayalım.',
    alan: 'ana_hedef',
    secenekler: [
      { deger: 'borctan_kurtulmak', etiket: 'Borçtan kurtulmak', aciklama: 'Kredi kartı, taksit ve kredilerimi bitirmek',
        ikon: <path d="M6 6l12 12M6 18L18 6" /> },
      { deger: 'hedefe_birikim', etiket: 'Hedefe birikim', aciklama: 'Ev, araba, tatil veya emeklilik için',
        ikon: <path d="M12 2L3 9l9 13 9-13z" /> },
      { deger: 'harcamalari_anlamak', etiket: 'Harcamayı anlamak', aciklama: 'Param nereye gidiyor görmek',
        ikon: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></> },
    ],
  },
  {
    soru: 'Harcama alışkanlığın?',
    aciklama: 'Sana doğru tonu yakalayabilmemiz için.',
    alan: 'harcama_aliskanligi',
    secenekler: [
      { deger: 'durtüsel', etiket: 'Dürtüsel', aciklama: 'Anlık karar veririm, plan beni sıkar',
        ikon: <path d="M13 2L3 14h7l-1 8 10-12h-7z" /> },
      { deger: 'planli_ama_kayiyor', etiket: 'Planlı ama kayıyor', aciklama: 'Bütçe yapıyorum ama tutturamıyorum',
        ikon: <path d="M3 6h18M3 12h18M3 18h12" /> },
      { deger: 'cok_tutumlu', etiket: 'Çok tutumlu', aciklama: 'Her kuruşu hesap ederim',
        ikon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> },
    ],
  },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const { kullanici } = useAuth()
  const { addToast } = useToast()

  const [adim, setAdim] = useState(0)
  const [yanitlar, setYanitlar] = useState({})
  const [yukleniyor, setYukleniyor] = useState(false)
  const [tamamlandi, setTamamlandi] = useState(false)
  const [hata, setHata] = useState('')

  const mevcutAdim = ADIMLAR[adim]
  const toplam = ADIMLAR.length
  const secili = yanitlar[mevcutAdim.alan]

  function secenekSec(deger) {
    setYanitlar(prev => ({ ...prev, [mevcutAdim.alan]: deger }))
  }

  async function devamEt() {
    if (!secili) return
    if (adim < toplam - 1) {
      setAdim(adim + 1)
    } else {
      await formGonder()
    }
  }

  async function formGonder() {
    setYukleniyor(true); setHata('')
    try {
      const userId = kullanici?.uid || localStorage.getItem('parapusula_user_id')
      if (!userId) throw new Error('Oturum bulunamadı.')

      await onboarding({
        user_id: userId,
        gelir_duzeni: yanitlar.gelir_duzeni,
        mevcut_durum: yanitlar.mevcut_durum,
        ana_hedef: yanitlar.ana_hedef,
        harcama_aliskanligi: yanitlar.harcama_aliskanligi,
      })
      localStorage.setItem('parapusula_user_id', userId)
      setTamamlandi(true)
      addToast('Profilin hazır! Pano açılıyor.', 'success')
      setTimeout(() => navigate('/dashboard'), 2000)
    } catch (err) {
      setHata(err.message || 'Bir hata oluştu.')
      setYukleniyor(false)
    }
  }

  if (tamamlandi) {
    return (
      <div style={sayfaStil}>
        <div className="card animate-fade-scale" style={{ textAlign: 'center', maxWidth: 480, padding: 56 }}>
          <div style={{
            width: 88, height: 88, margin: '0 auto 20px',
            borderRadius: '50%', background: 'var(--color-primary-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </div>
          <h2 className="heading-md" style={{ marginBottom: 8 }}>Hoş geldin!</h2>
          <p className="text-body">Pusulan ayarlandı, panona yönlendiriliyorsun.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={sayfaStil}>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: 760 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 40 }}>
          <svg width={32} height={32} viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="15" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" />
            <path d="M16 6 L19 16 L16 26 L13 16 Z" fill="#F59E0B" />
            <circle cx="16" cy="16" r="2" fill="#fff" />
          </svg>
          <span style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>ParaPusula</span>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 40 }}>
          {ADIMLAR.map((_, i) => {
            const tam = i < adim
            const akt = i === adim
            return (
              <React.Fragment key={i}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: (tam || akt) ? 'var(--color-primary)' : 'rgba(255,255,255,0.15)',
                  border: akt ? '2px solid var(--color-accent)' : 'none',
                  color: '#fff', fontSize: 14, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all var(--transition-base)',
                  flexShrink: 0,
                }}>
                  {tam ? (
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  ) : i + 1}
                </div>
                {i < ADIMLAR.length - 1 && (
                  <div style={{
                    flex: 1, maxWidth: 80, height: 2,
                    background: tam ? 'var(--color-primary)' : 'rgba(255,255,255,0.15)',
                    transition: 'background var(--transition-base)',
                  }} />
                )}
              </React.Fragment>
            )
          })}
        </div>

        {/* Kart */}
        <div className="card" style={{ padding: '40px 32px' }}>
          <p className="text-tiny" style={{ color: 'var(--color-primary)', marginBottom: 8 }}>
            Adım {adim + 1} / {toplam}
          </p>
          <h2 className="heading-md" style={{ marginBottom: 8 }}>{mevcutAdim.soru}</h2>
          <p className="text-body" style={{ marginBottom: 32 }}>{mevcutAdim.aciklama}</p>

          {/* Seçenek kartları */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 14,
            marginBottom: 32,
          }}>
            {mevcutAdim.secenekler.map(s => {
              const isSecili = secili === s.deger
              return (
                <button
                  key={s.deger}
                  onClick={() => secenekSec(s.deger)}
                  className="card card-interactive"
                  style={{
                    textAlign: 'left',
                    padding: 20,
                    border: isSecili ? '2px solid var(--color-primary)' : '2px solid var(--border-subtle)',
                    background: isSecili ? 'var(--color-primary-soft)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                    position: 'relative',
                    boxShadow: isSecili ? 'var(--shadow-md)' : 'var(--shadow-xs)',
                  }}
                >
                  {isSecili && (
                    <div style={{
                      position: 'absolute', top: 12, right: 12,
                      width: 22, height: 22, borderRadius: '50%',
                      background: 'var(--color-primary)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    </div>
                  )}
                  <div style={{
                    width: 40, height: 40, borderRadius: 'var(--radius-md)',
                    background: isSecili ? 'var(--color-primary)' : 'var(--color-primary-soft)',
                    color: isSecili ? '#fff' : 'var(--color-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 14,
                  }}>
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {s.ikon}
                    </svg>
                  </div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {s.etiket}
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {s.aciklama}
                  </p>
                </button>
              )
            })}
          </div>

          {hata && (
            <div style={{
              marginBottom: 16,
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.08)',
              color: '#B91C1C', fontSize: 13, fontWeight: 500,
            }}>{hata}</div>
          )}

          {/* Butonlar */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
            {adim > 0 ? (
              <button className="btn btn-ghost" onClick={() => setAdim(adim - 1)}>
                ← Geri
              </button>
            ) : <div />}
            <button
              className="btn btn-primary btn-lg"
              onClick={devamEt}
              disabled={!secili || yukleniyor}
            >
              {yukleniyor ? 'Hazırlanıyor...' : (adim === toplam - 1 ? 'Tamamla' : 'Devam →')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const sayfaStil = {
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #0A1A14 0%, #0D1F1A 40%, #1A3328 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
}
