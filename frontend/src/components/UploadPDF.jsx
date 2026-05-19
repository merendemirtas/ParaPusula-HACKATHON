// KARAR: Backend senkron olduğu için adımları 4 saniyede bir ilerletip API yanıtı geldiyse "tamamlandı"a geçiyoruz.
//        Eğer API erken biterse son adımda durup yanıtı bekliyor; geç biterse son adımda "biraz daha" mesajı.
import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadPDF } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'

const ADIMLAR_LISTESI = [
  'PDF okunuyor',
  'Harcamalar kategorize ediliyor',
  'Ekonomik veriler yükleniyor',
  'Borç haritan çiziliyor',
  'Planın hazırlanıyor',
]

const BANKALAR = [
  { ad: 'Ziraat', renk: '#E30613' },
  { ad: 'Halkbank', renk: '#0066B3' },
]

export default function UploadPDF() {
  const navigate = useNavigate()
  const { kullanici } = useAuth()
  const { addToast } = useToast()
  const userId = kullanici?.uid || ''
  const dosyaInputRef = useRef(null)
  const timerRef = useRef(null)

  const [secilenDosya, setSecilenDosya] = useState(null)
  const [secilenBanka, setSecilenBanka] = useState('Ziraat')
  const [durum, setDurum] = useState('bekliyor') // bekliyor | yukleniyor | tamamlandi | hata
  const [surukle, setSurukle] = useState(false)
  const [hata, setHata] = useState('')
  const [aktifAdim, setAktifAdim] = useState(0)
  const [apiTamamlandi, setApiTamamlandi] = useState(false)

  useEffect(() => () => clearInterval(timerRef.current), [])

  const dosyaSec = (e) => {
    const dosya = e.target.files?.[0]
    if (dosya) dogrulaVeAyarla(dosya)
  }

  const dogrulaVeAyarla = (dosya) => {
    setHata('')
    if (!dosya.name.toLowerCase().endsWith('.pdf')) { setHata('Yalnızca PDF dosyası yükleyebilirsiniz.'); return }
    if (dosya.size > 10 * 1024 * 1024) { setHata("Dosya boyutu 10 MB'dan küçük olmalıdır."); return }
    setSecilenDosya(dosya)
  }

  const yukle = async () => {
    if (!secilenDosya) { setHata('Lütfen bir PDF dosyası seçin.'); return }
    if (!userId) { setHata('Oturum bilgisi bulunamadı. Lütfen sayfayı yenileyin.'); return }

    setDurum('yukleniyor'); setHata(''); setAktifAdim(0); setApiTamamlandi(false)

    // Adımları 4sn'de bir ilerlet; son adımda dur (API'yi bekle).
    timerRef.current = setInterval(() => {
      setAktifAdim(prev => prev < ADIMLAR_LISTESI.length - 1 ? prev + 1 : prev)
    }, 4000)

    try {
      await uploadPDF(secilenDosya, userId, secilenBanka)
      clearInterval(timerRef.current)
      setAktifAdim(ADIMLAR_LISTESI.length) // hepsini tamamlanmış göster
      setApiTamamlandi(true)
      setDurum('tamamlandi')
      addToast('Analiz hazır!', 'success')
      // KARAR: /insight'a git — "Vay Be" anı gösterilsin;
      // insight sayfası gosterildi_mi=true ise direkt dashboard'a yönlendirir.
      setTimeout(() => navigate('/insight'), 1500)
    } catch (err) {
      clearInterval(timerRef.current)
      setDurum('hata')
      setHata(err.message || 'Yükleme sırasında hata oluştu.')
    }
  }

  const yenidenDene = () => {
    setDurum('bekliyor'); setSecilenDosya(null); setAktifAdim(0); setHata('')
  }

  // ─── Tamamlandı ekranı ──────────────────────────────────────
  if (durum === 'tamamlandi') {
    return (
      <div style={sayfaStil}>
        <div className="card animate-fade-scale" style={{ textAlign: 'center', padding: 56, maxWidth: 520, margin: '0 auto' }}>
          <div style={{
            width: 88, height: 88, margin: '0 auto 20px',
            borderRadius: '50%', background: 'rgba(53,107,89,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke="var(--color-positive)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </div>
          <h2 className="heading-md" style={{ marginBottom: 8 }}>Analizin hazır!</h2>
          <p className="text-body">Panona yönlendiriliyorsun...</p>
        </div>
      </div>
    )
  }

  // ─── Yükleniyor: progress timeline ──────────────────────────
  if (durum === 'yukleniyor') {
    return (
      <div style={sayfaStil}>
        <div className="animate-fade-in" style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}>
          <div className="card" style={{ padding: '40px 32px' }}>
            <h2 className="heading-md" style={{ marginBottom: 8 }}>Analiz yürütülüyor</h2>
            <p className="text-body" style={{ marginBottom: 32 }}>
              {secilenDosya?.name} işleniyor. Bu birkaç dakika sürebilir.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {ADIMLAR_LISTESI.map((etiket, i) => {
                const tam = i < aktifAdim || apiTamamlandi
                const akt = i === aktifAdim && !apiTamamlandi
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '14px 0' }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: tam ? 'var(--color-positive)' : (akt ? 'var(--color-primary-soft)' : 'rgba(15,23,42,0.04)'),
                      color: tam ? '#fff' : 'var(--color-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, transition: 'all var(--transition-base)',
                    }}>
                      {tam ? (
                        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l5 5L20 7" />
                        </svg>
                      ) : akt ? (
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-spin">
                          <path d="M21 12a9 9 0 1 1-6.2-8.55" />
                        </svg>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>{i + 1}</span>
                      )}
                    </div>
                    <div style={{ flex: 1, paddingTop: 4 }}>
                      <p style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: akt ? 600 : (tam ? 500 : 400),
                        color: tam ? 'var(--text-secondary)' : (akt ? 'var(--text-primary)' : 'var(--text-tertiary)'),
                      }}>
                        {etiket}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Bekliyor: form ────────────────────────────────────────
  return (
    <div style={sayfaStil}>
      <div className="animate-fade-in" style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
        <h1 className="heading-lg" style={{ marginBottom: 8 }}>PDF Yükle</h1>
        <p className="text-body" style={{ marginBottom: 32, fontSize: 16 }}>
          Banka ekstreni yükle, AI saniyeler içinde finansal haritanı çıkarsın.
        </p>

        <div className="card" style={{ padding: 32 }}>
          {/* Banka seçimi */}
          <label className="label" style={{ marginBottom: 12 }}>Banka</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
            {BANKALAR.map(b => {
              const akt = secilenBanka === b.ad
              return (
                <button
                  key={b.ad}
                  onClick={() => setSecilenBanka(b.ad)}
                  className="card card-interactive"
                  style={{
                    padding: 20,
                    border: akt ? '2px solid var(--color-primary)' : '2px solid var(--border-subtle)',
                    background: akt ? 'var(--color-primary-soft)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12,
                    boxShadow: akt ? 'var(--shadow-md)' : 'var(--shadow-xs)',
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 'var(--radius-md)',
                    background: b.renk, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700,
                  }}>
                    {b.ad[0]}
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{b.ad}</span>
                </button>
              )
            })}
          </div>

          {/* Drag-drop */}
          <label className="label" style={{ marginBottom: 12 }}>PDF Dosyası</label>
          <div
            onDragOver={(e) => { e.preventDefault(); setSurukle(true) }}
            onDragLeave={(e) => { e.preventDefault(); setSurukle(false) }}
            onDrop={(e) => {
              e.preventDefault(); setSurukle(false)
              const d = e.dataTransfer.files?.[0]
              if (d) dogrulaVeAyarla(d)
            }}
            onClick={() => dosyaInputRef.current?.click()}
            style={{
              border: `2px dashed ${surukle ? 'var(--color-primary)' : 'var(--border-default)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '40px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: surukle ? 'var(--color-primary-soft)' : 'rgba(53,107,89,0.02)',
              transition: 'all var(--transition-base)',
              boxShadow: surukle ? 'var(--shadow-glow)' : 'none',
            }}
          >
            <div style={{
              width: 56, height: 56, margin: '0 auto 12px',
              borderRadius: '50%', background: 'var(--color-primary-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-primary)',
            }}>
              <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4M6 10l6-6 6 6" />
                <path d="M4 20h16" />
              </svg>
            </div>

            {secilenDosya ? (
              <>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-primary)' }}>
                  {secilenDosya.name}
                </p>
                <p className="text-small" style={{ margin: '4px 0 0' }}>
                  {(secilenDosya.size / 1024 / 1024).toFixed(2)} MB · Değiştirmek için tıkla
                </p>
              </>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                  PDF sürükle bırak veya tıkla seç
                </p>
                <p className="text-small" style={{ margin: '4px 0 0' }}>
                  Maksimum 10 MB, yalnızca PDF
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

          {hata && (
            <div style={{
              marginTop: 16, padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#B91C1C', fontSize: 14, fontWeight: 500,
            }}>{hata}</div>
          )}

          <button
            onClick={yukle}
            disabled={!secilenDosya}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 24 }}
          >
            {secilenDosya ? 'Analizi Başlat' : 'Önce bir PDF seç'}
          </button>

          {durum === 'hata' && (
            <button onClick={yenidenDene} className="btn btn-ghost" style={{ width: '100%', marginTop: 12 }}>
              Yeniden Dene
            </button>
          )}
        </div>

        <p className="text-small" style={{ textAlign: 'center', marginTop: 16 }}>
          Verileriniz güvenli sekilde işlenir ve uçtan uca şifrelenir.
        </p>
      </div>
    </div>
  )
}

const sayfaStil = {
  minHeight: 'calc(100vh - 64px)',
  background: 'var(--bg-page)',
  padding: '40px 24px 80px',
}
