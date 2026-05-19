// KARAR: 6-satır grid; Row1=3kolon(Skor|Birikim|Nakit); Row2=2kolon(Gelir|Gider);
//        Row3=LineChart(3ay,linear,null-slot); Row4=Kıyaslama; Row5=BirikimDetay; Row6=YZÖneriler.
import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts'
import {
  getAnalysis, recalculate, reanalyze, getComparison, getGiderTrend,
  getGoals, createGoal, updateGoal, deleteGoal, addBirikim,
} from '../services/api.js'
import { useAuth }  from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import EmptyState   from './EmptyState.jsx'

// ─── Yardımcılar ──────────────────────────────────────────
const paraDuzenle = (sayi) => {
  if (!sayi && sayi !== 0) return '0 ₺'
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .format(Math.abs(sayi)) + ' ₺'
}
const AY_KISALT = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
const AY_TAM    = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

const skorRengi    = (s) => s >= 81 ? '#0D9488' : s >= 61 ? '#0D9488' : s >= 41 ? '#D97706' : '#E11D48'
const skorEtiketi  = (s) => s >= 81 ? 'Mükemmel' : s >= 61 ? 'İyi' : s >= 41 ? 'Dikkat' : 'Kritik'
const skorBadgeCls = (s) => s >= 81 ? 'badge-positive' : s >= 61 ? 'badge-warning' : s >= 41 ? 'badge-warning' : 'badge-negative'

const bitisTahmini = (hedef) => {
  const b = hedef?.birikimler || []
  if (b.length < 2) return null
  const son3 = b.slice(-3)
  const ort  = son3.reduce((s, x) => s + (x.tutar || 0), 0) / son3.length
  const kalan = Math.max(0, (hedef.hedef_tutar || 0) - (hedef.toplam_birikim || 0))
  if (ort <= 0 || kalan <= 0) return kalan <= 0 ? 'Tamamlandı 🎉' : null
  const aylar = Math.ceil(kalan / ort)
  const d = new Date()
  d.setMonth(d.getMonth() + aylar)
  return `${AY_TAM[d.getMonth()]} ${d.getFullYear()}`
}

const hedefPct = (h) => {
  const p = h?.hedef_tutar > 0 ? (h.toplam_birikim / h.hedef_tutar) * 100 : 0
  return Math.min(100, p)
}

const GRAD_RENKLER = [
  'linear-gradient(135deg,#0D9488,#0F766E)',
  'linear-gradient(135deg,#1E3A8A,#3B82F6)',
  'linear-gradient(135deg,#7C3AED,#A855F7)',
  'linear-gradient(135deg,#B45309,#F59E0B)',
  'linear-gradient(135deg,#0F172A,#475569)',
]

// ─── Ana Bileşen ──────────────────────────────────────────
export default function Dashboard() {
  const navigate    = useNavigate()
  const { kullanici } = useAuth()
  const { addToast } = useToast()
  const userId = kullanici?.uid || localStorage.getItem('parapusula_user_id') || ''

  const [analiz,    setAnaliz]    = useState(null)
  const [trend,     setTrend]     = useState([])
  const [karsilastirma, setKarsilastirma] = useState(null)
  const [hedefler,  setHedefler]  = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hesaplaniyor, setHesaplaniyor] = useState(false)
  const [analizediliyor, setAnalizediliyor] = useState(false)

  // Modal state'leri
  const [detayModal,   setDetayModal]   = useState(false)
  const [olusturModal, setOlusturModal] = useState(null)  // null | 'yeni' | hedefObj (düzenleme)
  const [birikimModal, setBirikimModal] = useState(false) // BirikimEkleModal

  useEffect(() => { veriGetir() }, [userId])

  async function veriGetir() {
    if (!userId) return
    setYukleniyor(true)
    try {
      const [a, t, g] = await Promise.all([
        getAnalysis(userId),
        getGiderTrend(userId).catch(() => ({ veri: [] })),
        getGoals(userId).catch(() => ({ hedefler: [] })),
      ])
      setAnaliz(a)
      setTrend(t.veri || [])
      setHedefler(g.hedefler || [])
      getComparison(userId).then(k => setKarsilastirma(k)).catch(() => {})
    } catch (err) {
      if (!err.message?.includes('404')) addToast('Analiz yüklenemedi.', 'error')
      setAnaliz(null)
    } finally {
      setYukleniyor(false)
    }
  }

  async function hedefleriYenile() {
    try {
      const g = await getGoals(userId)
      setHedefler(g.hedefler || [])
    } catch { /* sessiz hata */ }
  }

  async function yenidenHesapla() {
    if (!userId || hesaplaniyor) return
    setHesaplaniyor(true)
    try { await recalculate(userId); await veriGetir(); addToast('Skorun yeniden hesaplandı.', 'success') }
    catch (err) { addToast('Hesaplama başarısız: ' + err.message, 'error') }
    finally     { setHesaplaniyor(false) }
  }

  async function yenidenAnaliz() {
    if (!userId || analizediliyor) return
    setAnalizediliyor(true)
    try {
      const sonuc = await reanalyze(userId)
      await veriGetir()
      const mesaj = sonuc.degisim_sayisi > 0
        ? `${sonuc.degisim_sayisi} borç sınıfı güncellendi, skor: ${sonuc.yeni_skor}`
        : 'Sınıflandırma zaten güncel.'
      addToast(mesaj, 'success')
    } catch (err) {
      addToast('Yeniden analiz başarısız: ' + err.message, 'error')
    } finally {
      setAnalizediliyor(false)
    }
  }

  if (yukleniyor) return <DashboardSkeleton />

  if (!analiz) {
    return (
      <div style={sayfaStil}>
        <div style={konteynerStil}>
          <h1 className="heading-lg" style={{ marginBottom: 8 }}>Dashboard</h1>
          <p className="text-body" style={{ marginBottom: 32 }}>Finansal durumunuzu görmek için banka ekstreni yükleyin.</p>
          <div onClick={() => navigate('/upload')} className="card card-interactive animate-fade-in"
            style={{ padding: 56, textAlign: 'center', cursor: 'pointer', border: '2px dashed var(--border-default)', maxWidth: 560, margin: '0 auto' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-primary-soft)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M6 10l6-6 6 6" /><path d="M4 20h16" /></svg>
            </div>
            <h2 className="heading-md" style={{ marginBottom: 10 }}>Banka Ekstrenizi Yükleyin</h2>
            <p className="text-body" style={{ margin: 0 }}>Ziraat veya Halkbank PDF — AI saniyeler içinde analiz etsin.</p>
          </div>
        </div>
      </div>
    )
  }

  const skor       = analiz.finansal_skor || 0
  const gelir      = analiz.gelir || 0
  const gider      = analiz.toplam_gider || 0
  const nakitAkisi = analiz.nakit_akisi || 0
  const oneriler   = analiz.oneriler || []
  const radialData = [{ name: 'skor', value: skor, fill: skorRengi(skor) }]

  // En yüksek tamamlanma yüzdesine sahip hedef (row 1 kartı için)
  const oncelikliHedef = hedefler.length > 0
    ? [...hedefler].sort((a, b) => hedefPct(b) - hedefPct(a))[0]
    : null

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
    <div style={sayfaStil}>
      <div style={konteynerStil}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
          <div>
            <h1 className="heading-lg">Dashboard</h1>
            <p className="text-body" style={{ marginTop: 4 }}>
              {analiz.ay} · {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={yenidenHesapla} disabled={hesaplaniyor} className="btn btn-secondary">
              {hesaplaniyor ? (<><svg className="animate-spin" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.2-8.55" /></svg> Hesaplanıyor...</>) : 'Yeniden Hesapla'}
            </button>
            <button onClick={yenidenAnaliz} disabled={analizediliyor} className="btn btn-secondary" title="Borç sınıflandırmalarını güncel kurallara göre yeniden hesapla">
              {analizediliyor ? 'Analiz ediliyor...' : 'Borçları Yeniden Analiz Et'}
            </button>
            <button onClick={() => navigate('/upload')} className="btn btn-secondary" style={{ gap: 8 }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M6 10l6-6 6 6" /><path d="M4 20h16" /></svg>
              Yeni Ekstre
            </button>
          </div>
        </div>

        {/* ── SATIR 1: Finansal Skor | Birikim Hedefi ─────────── */}
        <div className="grid-2" style={{ marginBottom: 16 }}>
          {/* Finansal Sağlık Skoru — sol: radial, sağ: parametre listesi */}
          <div className="card animate-fade-in" style={{ padding: 24 }}>
            <p className="text-tiny" style={{ color: 'var(--color-primary)', marginBottom: 16 }}>FİNANSAL SAĞLIK</p>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              {/* Sol: dairesel gösterge (%40) */}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative', width: 120, height: 120 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart innerRadius="80%" outerRadius="100%" data={radialData} startAngle={90} endAngle={-270}>
                      <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                      <RadialBar background={{ fill: '#F1F5F9' }} dataKey="value" cornerRadius={16} angleAxisId={0} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 30, fontWeight: 700, color: skorRengi(skor), lineHeight: 1 }}>{skor}</span>
                  </div>
                </div>
                <span className={`badge ${skorBadgeCls(skor)}`} style={{ fontSize: 10 }}>{skorEtiketi(skor)}</span>
              </div>

              {/* Sağ: parametre listesi (%60) */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { ad: 'Nakit Akışı',  puan: Math.round(30 * skor / 100), max: 30 },
                  { ad: 'Borç/Gelir',   puan: Math.round(25 * skor / 100), max: 25 },
                  { ad: 'Tasarruf',     puan: Math.round(20 * skor / 100), max: 20 },
                  { ad: 'Harcama',      puan: Math.round(15 * skor / 100), max: 15 },
                  { ad: 'Gelir Düzeni', puan: Math.round(10 * skor / 100), max: 10 },
                ].map(f => (
                  <div key={f.ad} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 80, flexShrink: 0, fontWeight: 500 }}>{f.ad}</span>
                    <div style={{ flex: 1, height: 5, background: 'var(--border-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${(f.puan / f.max) * 100}%`,
                        background: 'var(--color-primary)',
                        borderRadius: 3,
                        transition: 'width 600ms ease',
                      }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', width: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {f.puan}/{f.max}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Birikim Hedefi Kartı */}
          <BirikimHedefiKarti
            hedef={oncelikliHedef}
            hedefler={hedefler}
            hedefIndex={0}
            onDetayAc={() => setDetayModal(true)}
            onBirikimEkle={() => setBirikimModal(true)}
            onHedefEkle={() => setOlusturModal('yeni')}
          />
        </div>

        {/* ── SATIR 2: Gelir | Gider | Nakit Akışı ───────────── */}
        <div className="grid-3" style={{ marginBottom: 16 }}>
          <MetrikKart etiket="Bu Ay Gelir" deger={paraDuzenle(gelir)} renk="var(--color-positive)" yon="up" />
          <MetrikKart etiket="Bu Ay Gider" deger={paraDuzenle(gider)} renk="var(--color-negative)" yon="down" />
          <MetrikKart
            etiket="Nakit Akışı"
            deger={(nakitAkisi >= 0 ? '+' : '−') + paraDuzenle(Math.abs(nakitAkisi))}
            renk={nakitAkisi >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'}
            yon={nakitAkisi >= 0 ? 'up' : 'down'}
          />
        </div>

        {/* ── SATIR 3: Son 3 Ay Line Chart ───────────────────── */}
        <GiderTrendChart veri={trend} />

        {/* ── SATIR 4: Geçen Aya Göre ────────────────────────── */}
        {karsilastirma?.delta && <AylikKarsilastirma delta={karsilastirma.delta} oncekiAy={karsilastirma.onceki_ay} />}

        {/* ── SATIR 5: Yapay Zeka Önerileri ──────────────────── */}
        {oneriler.length > 0 && <YZOneriler oneriler={oneriler} />}
      </div>

      {/* ── Modaller ─────────────────────────────────────────── */}
      {detayModal && (
        <BirikimDetayModal
          userId={userId}
          hedefler={hedefler}
          onKapat={() => setDetayModal(false)}
          onGuncelle={hedefleriYenile}
          onDuzenle={(h) => { setDetayModal(false); setOlusturModal(h) }}
          onBirikimEkle={() => setBirikimModal(true)}
          addToast={addToast}
        />
      )}

      {olusturModal && (
        <HedefOlusturModal
          userId={userId}
          duzenle={olusturModal !== 'yeni' ? olusturModal : null}
          onKapat={() => setOlusturModal(null)}
          onKaydet={hedefleriYenile}
          addToast={addToast}
        />
      )}

      {birikimModal && (
        <BirikimEkleModal
          userId={userId}
          hedefler={hedefler}
          onKapat={() => setBirikimModal(false)}
          onKaydet={hedefleriYenile}
          addToast={addToast}
        />
      )}

      {/* Grid responsive stiller */}
      <style>{`
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        @media (max-width: 768px) { .grid-2 { grid-template-columns: 1fr; } }
        @media (max-width: 768px) { .grid-3 { grid-template-columns: 1fr; } }
      `}</style>
    </div>
    </motion.div>
  )
}

// ─── Birikim Hedefi Kartı (Row 1) ────────────────────────
function BirikimHedefiKarti({ hedef, hedefler, hedefIndex, onDetayAc, onBirikimEkle, onHedefEkle }) {
  const [menuAcik, setMenuAcik] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAcik(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!hedef) {
    return (
      <div onClick={onHedefEkle} className="card card-interactive animate-fade-in"
        style={{ padding: 24, minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', border: '2px dashed var(--border-default)', background: 'rgba(13,148,136,0.02)' }}>
        <span style={{ fontSize: 40 }}>🎯</span>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Birikim Hedefi</h3>
          <p className="text-body" style={{ margin: 0, fontSize: 13 }}>Hedef belirle, hayallerine adım at</p>
        </div>
        <button className="btn btn-primary" style={{ fontSize: 13, padding: '10px 20px' }}>+ Hedef Ekle</button>
      </div>
    )
  }

  const pct    = hedefPct(hedef)
  const tahmin = bitisTahmini(hedef)
  const fotograf = hedef.fotograf_url || ''
  const gradIndex = hedefler.indexOf(hedef) % GRAD_RENKLER.length
  const donutVeri = [{ value: hedef.toplam_birikim || 0, fill: '#0D9488' }, { value: Math.max(0, (hedef.hedef_tutar || 0) - (hedef.toplam_birikim || 0)), fill: 'rgba(255,255,255,0.2)' }]

  return (
    <div
      onClick={onDetayAc}
      className="card card-interactive animate-fade-in"
      style={{
        padding: 0, minHeight: 200, overflow: 'hidden', cursor: 'pointer', position: 'relative',
        background: fotograf ? `url(${fotograf}) center/cover no-repeat` : GRAD_RENKLER[gradIndex],
      }}
    >
      {/* Karanlık overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(1px)' }} />

      <div style={{ position: 'relative', zIndex: 1, padding: 20, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 200 }}>
        {/* Üst: başlık + menü */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>BİRİKİM HEDEFİ</p>
            <h3 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: '#fff' }}>{hedef.ad}</h3>
          </div>
          <div ref={menuRef} style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={(e) => { e.stopPropagation(); setMenuAcik(!menuAcik) }}
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
              ⋯
            </button>
            {menuAcik && (
              <div className="card animate-fade-scale" style={{ position: 'absolute', top: 38, right: 0, minWidth: 180, padding: 8, zIndex: 200, boxShadow: 'var(--shadow-lg)' }}>
                <button onClick={(e) => { e.stopPropagation(); setMenuAcik(false); onBirikimEkle() }} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', fontSize: 13 }}>Bu aya birikim ekle</button>
                <button onClick={(e) => { e.stopPropagation(); setMenuAcik(false); onDetayAc() }} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', fontSize: 13 }}>Tüm hedefler</button>
              </div>
            )}
          </div>
        </div>

        {/* Orta: mini donut */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
            <PieChart width={80} height={80}>
              <Pie data={donutVeri} innerRadius={26} outerRadius={38} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                {donutVeri.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
            </PieChart>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>%{pct.toFixed(0)}</span>
            </div>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
              {paraDuzenle(hedef.toplam_birikim)} birikti
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
              Hedef: {paraDuzenle(hedef.hedef_tutar)}
            </p>
          </div>
        </div>

        {/* Alt: tahmin */}
        <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
          {tahmin ? `⏳ Tahmini: ${tahmin}` : '— Aylık birikim girdikçe tahmin hesaplanır'}
        </p>
      </div>
    </div>
  )
}

// ─── Son 3 Ay Line Chart ──────────────────────────────────
function GiderTrendChart({ veri }) {
  const CustomDot = (props) => {
    const { cx, cy, payload } = props
    if (payload?.toplam_gider == null) return null
    return <circle cx={cx} cy={cy} r={5} fill="#0D9488" stroke="#fff" strokeWidth={2} />
  }

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    if (!d || d.toplam_gider == null) return null
    return (
      <div style={{ background: 'var(--bg-surface)', padding: '10px 14px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-default)' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{d.ay_tam || d.ay_kisalt}</p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-negative)', fontWeight: 600 }}>
          {paraDuzenle(d.toplam_gider)}
        </p>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 className="heading-sm" style={{ margin: 0 }}>Son 3 Ay Gider Trendi</h2>
        <p className="text-small" style={{ margin: '4px 0 0' }}>Aylara göre toplam harcama değişimi</p>
      </div>
      {veri.every(v => v.toplam_gider == null) ? (
        <p className="text-body" style={{ margin: 0 }}>Geçmiş veri yok — her ay ekstre yükledikçe grafik dolacak.</p>
      ) : (() => {
        // KARAR: Dinamik Y domain — verinin %85-115 aralığı, yuvarlak sayıya indir/çıkar.
        const degerler = veri.map(v => v.toplam_gider).filter(v => v != null)
        const enDusuk = Math.min(...degerler)
        const enYuksek = Math.max(...degerler)
        const yMin = Math.floor(enDusuk * 0.85 / 1000) * 1000
        const yMax = Math.ceil(enYuksek * 1.15 / 1000) * 1000
        return (
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={veri} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0D9488" />
                    <stop offset="100%" stopColor="#E11D48" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="ay_kisalt" tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[yMin, yMax]}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}K`}
                  tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                  axisLine={false} tickLine={false} width={42}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="linear"
                  dataKey="toplam_gider"
                  stroke="url(#lineGrad)"
                  strokeWidth={2.5}
                  dot={<CustomDot />}
                  activeDot={{ r: 8, fill: '#0D9488', stroke: '#fff', strokeWidth: 2 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Aylık Kıyaslama ──────────────────────────────────────
function AylikKarsilastirma({ delta, oncekiAy }) {
  const { skor_bu, skor_once, skor_delta, gider_bu, gider_once, gider_pct, en_cok_artan, en_cok_azalan, borc_odenen, borc_pct } = delta
  return (
    <div className="card animate-fade-in" style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <p className="text-tiny" style={{ color: 'var(--color-primary)', margin: 0 }}>GEÇEN AYA GÖRE</p>
        <span className="badge badge-neutral" style={{ fontSize: 10 }}>{oncekiAy}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <KarsilastirmaMetrik etiket="Finansal Skor" deger={`${skor_once} → ${skor_bu}`} fark={`${skor_delta >= 0 ? '↑' : '↓'} ${Math.abs(skor_delta)} puan`} iyi={skor_delta >= 0} />
        <KarsilastirmaMetrik etiket="Aylık Gider" deger={`${new Intl.NumberFormat('tr-TR',{maximumFractionDigits:0}).format(gider_once)}→${new Intl.NumberFormat('tr-TR',{maximumFractionDigits:0}).format(gider_bu)} ₺`} fark={`${gider_pct >= 0 ? '▲' : '▼'} %${Math.abs(gider_pct).toFixed(1)}`} iyi={gider_pct <= 0} />
        {en_cok_artan && <KarsilastirmaMetrik etiket="En Çok Artan" deger={en_cok_artan.kategori} fark={`▲ %${Math.abs(en_cok_artan.pct).toFixed(1)}`} iyi={false} />}
        {en_cok_azalan?.pct < 0 && <KarsilastirmaMetrik etiket="En Çok Azalan" deger={en_cok_azalan.kategori} fark={`▼ %${Math.abs(en_cok_azalan.pct).toFixed(1)}`} iyi />}
        {borc_odenen > 0 && <KarsilastirmaMetrik etiket="Borç Ödemesi" deger={`${new Intl.NumberFormat('tr-TR',{maximumFractionDigits:0}).format(borc_odenen)} ₺`} fark={`▼ %${Math.abs(borc_pct).toFixed(1)} azaldı`} iyi />}
      </div>
    </div>
  )
}

function KarsilastirmaMetrik({ etiket, deger, fark, iyi }) {
  return (
    <div style={{ padding: 14, background: iyi ? 'rgba(13,148,136,0.04)' : 'rgba(225,29,72,0.04)', borderRadius: 'var(--radius-md)', border: `1px solid ${iyi ? 'rgba(13,148,136,0.12)' : 'rgba(225,29,72,0.12)'}` }}>
      <p className="text-tiny" style={{ margin: '0 0 4px' }}>{etiket}</p>
      <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{deger}</p>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: iyi ? 'var(--color-positive)' : 'var(--color-negative)' }}>{fark}</p>
    </div>
  )
}

// ─── Birikim Hedefleri Bölümü (Row 5) ────────────────────
function BirikimHedefleriBolum({ userId, hedefler, onHedefEkle, onDetayAc, onGuncelle, addToast }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="heading-sm">Birikim Hedeflerim</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {hedefler.length > 0 && <button onClick={onDetayAc} className="btn btn-ghost" style={{ fontSize: 13 }}>Tüm Detaylar</button>}
          <button onClick={onHedefEkle} className="btn btn-secondary" style={{ fontSize: 13, gap: 6 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Hedef Ekle
          </button>
        </div>
      </div>

      {hedefler.length === 0 ? (
        <div onClick={onHedefEkle} className="card card-interactive" style={{ padding: 40, textAlign: 'center', cursor: 'pointer', border: '2px dashed var(--border-default)', background: 'rgba(13,148,136,0.02)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600 }}>Birikim hedefi ekle</h3>
          <p className="text-body" style={{ margin: 0 }}>Araba, ev, tatil... Hedefinizi belirleyin, ilerlemenizi takip edin.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {hedefler.map((h, i) => <MiniHedefKarti key={h.id} hedef={h} gradIndex={i % GRAD_RENKLER.length} onClick={onDetayAc} />)}
          <div onClick={onHedefEkle} className="card card-interactive" style={{ padding: 24, textAlign: 'center', cursor: 'pointer', border: '2px dashed var(--border-default)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
            <span style={{ fontSize: 28, color: 'var(--color-primary)', display: 'block', marginBottom: 6 }}>+</span>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Yeni Hedef</p>
          </div>
        </div>
      )}
    </div>
  )
}

function MiniHedefKarti({ hedef, gradIndex, onClick }) {
  const pct = hedefPct(hedef)
  return (
    <div onClick={onClick} className="card card-interactive" style={{ padding: 20, cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{hedef.ad}</h3>
          <p className="text-small" style={{ margin: '2px 0 0' }}>Hedef: {paraDuzenle(hedef.hedef_tutar)}</p>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0D9488', background: '#CCFBF1', padding: '2px 8px', borderRadius: 20 }}>%{pct.toFixed(0)}</span>
      </div>
      {/* Mini progress bar */}
      <div style={{ height: 6, background: 'var(--border-subtle)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-positive)', borderRadius: 3, transition: 'width 600ms ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Birikti: {paraDuzenle(hedef.toplam_birikim)}</span>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Kalan: {paraDuzenle(Math.max(0, hedef.hedef_tutar - hedef.toplam_birikim))}</span>
      </div>
    </div>
  )
}

// ─── Birikim Detay Modal ──────────────────────────────────
function BirikimDetayModal({ userId, hedefler, onKapat, onGuncelle, onDuzenle, onBirikimEkle, addToast }) {
  const [aktifId, setAktifId] = useState(hedefler[0]?.id)
  const [silOnay, setSilOnay] = useState(null)

  const aktif = hedefler.find(h => h.id === aktifId) || hedefler[0]
  if (!aktif) return null

  const pct    = hedefPct(aktif)
  const tahmin = bitisTahmini(aktif)
  const donutVeri = [
    { value: aktif.toplam_birikim || 0,    fill: '#0D9488' },
    { value: Math.max(0, (aktif.hedef_tutar || 0) - (aktif.toplam_birikim || 0)), fill: '#F1F5F9' },
  ]
  const fotograf = aktif.fotograf_url || ''

  async function silHedef(hedefId) {
    try {
      await deleteGoal(userId, hedefId)
      await onGuncelle()
      addToast('Hedef silindi.', 'info')
      setSilOnay(null)
      if (hedefler.length <= 1) onKapat()
      else setAktifId(hedefler.find(h => h.id !== hedefId)?.id)
    } catch (err) {
      addToast('Hedef silinemedi: ' + err.message, 'error')
    }
  }

  const birikimSirali = [...(aktif.birikimler || [])].sort((a, b) => b.ay.localeCompare(a.ay))

  return (
    <div onClick={onKapat} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} className="animate-fade-scale"
        style={{ background: 'var(--bg-surface)', width: '100%', maxWidth: 840, maxHeight: '90vh', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-xl)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Banner */}
        <div style={{ position: 'relative', height: 180, background: fotograf ? `url(${fotograf}) center/cover no-repeat` : GRAD_RENKLER[hedefler.indexOf(aktif) % GRAD_RENKLER.length], flexShrink: 0 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
          <div style={{ position: 'absolute', inset: 0, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#fff' }}>{aktif.ad}</h2>
            {aktif.aciklama && <p style={{ margin: '4px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic' }}>{aktif.aciklama}</p>}
          </div>
          <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8 }}>
            <button onClick={() => onDuzenle(aktif)} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '6px 12px', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>✏️ Düzenle</button>
            <button onClick={onKapat} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: 36, height: 36, color: '#fff', cursor: 'pointer', fontSize: 16, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: 24, flex: 1 }}>
          {/* Donut + Metrikler */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 180, height: 180, flexShrink: 0 }}>
              <PieChart width={180} height={180}>
                <Pie data={donutVeri} innerRadius={58} outerRadius={86} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                  {donutVeri.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
              </PieChart>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-positive)', lineHeight: 1 }}>{paraDuzenle(aktif.toplam_birikim)}</span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>/ {paraDuzenle(aktif.hedef_tutar)}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 4 }}>%{pct.toFixed(1)}</span>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {[
                  { e: 'Tamamlanan', d: paraDuzenle(aktif.toplam_birikim), renk: 'var(--color-positive)' },
                  { e: 'Kalan',      d: paraDuzenle(Math.max(0, aktif.hedef_tutar - aktif.toplam_birikim)), renk: 'var(--color-negative)' },
                  { e: 'Tahmini Bitiş', d: tahmin || '— Veri yetersiz', renk: 'var(--color-primary)' },
                ].map(m => (
                  <div key={m.e} style={{ padding: '10px 12px', background: 'rgba(13,148,136,0.03)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>{m.e}</p>
                    <p style={{ margin: '3px 0 0', fontSize: 14, fontWeight: 700, color: m.renk }}>{m.d}</p>
                  </div>
                ))}
              </div>
              <button onClick={onBirikimEkle} className="btn btn-primary" style={{ width: '100%', gap: 8 }}>
                <span style={{ fontSize: 18 }}>+</span> Bu Ay Birikim Ekle
              </button>
            </div>
          </div>

          {/* Birikim geçmişi */}
          {birikimSirali.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>Birikim Geçmişi</h3>
              {birikimSirali.map((b, i) => {
                const [yil, ayNo] = b.ay.split('-').map(Number)
                const ayAdi = `${AY_TAM[ayNo - 1]} ${yil}`
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{ayAdi}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-positive)' }}>{paraDuzenle(b.tutar)}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Diğer hedefler */}
          {hedefler.length > 1 && (
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>Diğer Hedefler</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {hedefler.filter(h => h.id !== aktif.id).map(h => (
                  <button key={h.id} onClick={() => setAktifId(h.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg-page)', border: '1px solid var(--border-subtle)', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{h.ad}</p>
                      <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${hedefPct(h)}%`, background: 'var(--color-positive)' }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{hedefPct(h).toFixed(0)}%</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sil butonu */}
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => setSilOnay(aktif.id)} className="btn btn-ghost" style={{ color: 'var(--color-negative)', fontSize: 13 }}>
              🗑️ Bu hedefi sil
            </button>
          </div>
        </div>
      </div>

      {/* Silme Onayı */}
      {silOnay && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card animate-fade-scale" style={{ maxWidth: 400, padding: 28, boxShadow: 'var(--shadow-xl)' }}>
            <h3 className="heading-sm" style={{ marginBottom: 12 }}>Emin misin?</h3>
            <p className="text-body" style={{ marginBottom: 20 }}>"{aktif.ad}" hedefini ve tüm birikim geçmişini sileceksin.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setSilOnay(null)} className="btn btn-ghost">Hayır, iptal</button>
              <button onClick={() => silHedef(silOnay)} className="btn btn-primary" style={{ background: 'var(--color-negative)' }}>Evet, sil</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Hedef Oluştur / Düzenle Modal ───────────────────────
function HedefOlusturModal({ userId, duzenle, onKapat, onKaydet, addToast }) {
  const [ad,       setAd]       = useState(duzenle?.ad || '')
  const [tutar,    setTutar]    = useState(duzenle?.hedef_tutar || '')
  const [aciklama, setAciklama] = useState(duzenle?.aciklama || '')
  const [fotoMod,  setFotoMod]  = useState('url')   // 'url' | 'dosya'
  const [fotoUrl,  setFotoUrl]  = useState(duzenle?.fotograf_url || '')
  const [fotoOniz, setFotoOniz] = useState(duzenle?.fotograf_url || '')
  const [yukleniyor, setYuk]    = useState(false)

  function dosyaSec(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 512 * 1024) { addToast('Dosya çok büyük. Maksimum 500 KB.', 'error'); return }
    const reader = new FileReader()
    reader.onload = (ev) => { setFotoOniz(ev.target.result); setFotoUrl(ev.target.result) }
    reader.readAsDataURL(f)
  }

  async function kaydet() {
    if (!ad.trim() || !tutar || parseFloat(tutar) <= 0) return
    setYuk(true)
    try {
      const payload = { ad: ad.trim(), hedef_tutar: parseFloat(tutar), aciklama: aciklama.trim(), fotograf_url: fotoUrl.trim() }
      if (duzenle) {
        await updateGoal(userId, duzenle.id, payload)
        addToast('Hedef güncellendi ✓', 'success')
      } else {
        await createGoal(userId, payload)
        addToast(`"${ad.trim()}" hedefi oluşturuldu ✓`, 'success')
      }
      await onKaydet()
      onKapat()
    } catch (err) {
      addToast('Kaydedilemedi: ' + err.message, 'error')
    } finally {
      setYuk(false)
    }
  }

  return (
    <div onClick={onKapat} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} className="card animate-fade-scale" style={{ width: '100%', maxWidth: 520, padding: 32, boxShadow: 'var(--shadow-xl)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 className="heading-sm" style={{ margin: 0 }}>{duzenle ? 'Hedefi Düzenle' : 'Birikim Hedefi Ekle'}</h2>
          <button onClick={onKapat} className="btn btn-ghost" style={{ padding: 6, borderRadius: '50%' }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M6 18L18 6" /></svg>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label" htmlFor="hAd">Hedef Adı *</label>
            <input id="hAd" className="input" value={ad} onChange={e => setAd(e.target.value)} placeholder="Araba, Ev, Tatil, Emeklilik..." autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="hTutar">Hedef Tutar (TL) *</label>
            <input id="hTutar" className="input" type="number" min="1" value={tutar} onChange={e => setTutar(e.target.value)} placeholder="1000000" />
          </div>
          <div>
            <label className="label" htmlFor="hAciklama">Açıklama (opsiyonel)</label>
            <textarea id="hAciklama" className="input" rows={2} value={aciklama} onChange={e => setAciklama(e.target.value)} placeholder="Bu hedef neden önemli?" style={{ resize: 'none' }} />
          </div>
          <div>
            <label className="label">Fotoğraf (opsiyonel)</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {['url', 'dosya'].map(m => (
                <button key={m} onClick={() => setFotoMod(m)} className={`btn btn-${fotoMod === m ? 'primary' : 'secondary'}`} style={{ fontSize: 12, padding: '6px 14px' }}>
                  {m === 'url' ? 'URL Gir' : 'Dosya Yükle'}
                </button>
              ))}
            </div>
            {fotoMod === 'url' ? (
              <input className="input" value={fotoUrl} onChange={e => { setFotoUrl(e.target.value); setFotoOniz(e.target.value) }} placeholder="https://..." />
            ) : (
              <label style={{ display: 'block', padding: '12px 16px', border: '1.5px dashed var(--border-default)', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={dosyaSec} />
                📷 Dosya seç (max 500 KB)
              </label>
            )}
            {fotoOniz && (
              <div style={{ marginTop: 10, borderRadius: 8, overflow: 'hidden', height: 100 }}>
                <img src={fotoOniz} alt="önizleme" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setFotoOniz('')} />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={onKapat} className="btn btn-ghost">İptal</button>
            <button onClick={kaydet} disabled={!ad.trim() || !tutar || parseFloat(tutar) <= 0 || yukleniyor} className="btn btn-primary">
              {yukleniyor ? 'Kaydediliyor...' : (duzenle ? 'Güncelle' : 'Kaydet')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Birikim Ekle Modal ───────────────────────────────────
function BirikimEkleModal({ userId, hedefler, onKapat, onKaydet, addToast }) {
  const buAy = new Date().toISOString().slice(0, 7)
  const AY_TAM_LOC = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
  const buAyLabel  = `${AY_TAM_LOC[new Date().getMonth()]} ${new Date().getFullYear()}`

  const [seciliHedefId, setSeciliHedefId] = useState(hedefler[0]?.id || '')
  const [tutar,         setTutar]         = useState('')
  const [yukleniyor,    setYuk]           = useState(false)

  async function kaydet() {
    if (!tutar || parseFloat(tutar) <= 0 || !seciliHedefId) return
    setYuk(true)
    try {
      await addBirikim(userId, seciliHedefId, { tutar: parseFloat(tutar), ay: buAy })
      const hedefAdi = hedefler.find(h => h.id === seciliHedefId)?.ad || ''
      addToast(`${paraDuzenle(parseFloat(tutar))} birikim kaydedildi ✓ (${hedefAdi})`, 'success')
      await onKaydet()
      onKapat()
    } catch (err) {
      addToast('Birikim kaydedilemedi: ' + err.message, 'error')
    } finally {
      setYuk(false)
    }
  }

  return (
    <div onClick={onKapat} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} className="card animate-fade-scale" style={{ width: '100%', maxWidth: 440, padding: 32, boxShadow: 'var(--shadow-xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 className="heading-sm" style={{ margin: 0 }}>Bu Ay Birikim Ekle</h2>
          <button onClick={onKapat} className="btn btn-ghost" style={{ padding: 6, borderRadius: '50%' }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M6 18L18 6" /></svg>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {hedefler.length > 1 && (
            <div>
              <label className="label" htmlFor="bHedef">Hangi Hedef?</label>
              <select id="bHedef" className="input" value={seciliHedefId} onChange={e => setSeciliHedefId(e.target.value)}>
                {hedefler.map(h => <option key={h.id} value={h.id}>{h.ad} — %{hedefPct(h).toFixed(0)} tamamlandı</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Ay</label>
            <div className="input" style={{ background: 'var(--bg-page)', cursor: 'default', color: 'var(--text-secondary)' }}>{buAyLabel}</div>
          </div>
          <div>
            <label className="label" htmlFor="bTutar">Bu ay ne kadar ayırdın? (TL)</label>
            <input id="bTutar" className="input" type="number" min="1" value={tutar} onChange={e => setTutar(e.target.value)} placeholder="10000" autoFocus />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={onKapat} className="btn btn-ghost">İptal</button>
            <button onClick={kaydet} disabled={!tutar || parseFloat(tutar) <= 0 || yukleniyor} className="btn btn-primary">
              {yukleniyor ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── YZ Önerileri ─────────────────────────────────────────
function YZOneriler({ oneriler }) {
  const [aciklar, setAciklar] = useState({})
  function toggle(id) { setAciklar(prev => ({ ...prev, [id]: !prev[id] })) }

  const normalize = (o, i) => ({
    id:        o.id || `oneri_${i}`,
    ana_fikir: o.ana_fikir || o.baslik || 'Öneri',
    oncelik:   typeof o.oncelik === 'string' ? o.oncelik : (o.oncelik === 1 ? 'Yüksek' : o.oncelik === 2 ? 'Orta' : 'Düşük'),
    kazanim:   o.kazanim || '',
    maddeler:  o.maddeler || (o.aciklama ? [o.aciklama] : []),
  })
  const siralama = { 'Yüksek': 0, 'Orta': 1, 'Düşük': 2 }
  const siraliOneriler = oneriler.map(normalize).sort((a, b) => (siralama[a.oncelik] ?? 1) - (siralama[b.oncelik] ?? 1))

  const stilMap = {
    'Yüksek': { bant: '#E11D48', emoji: '🔴', etiket: 'YÜKSEK ÖNCELİK', cls: 'badge-negative', badgeBg: '#FFE4E6', badgeText: '#E11D48' },
    'Orta':   { bant: '#D97706', emoji: '🟡', etiket: 'ORTA ÖNCELİK',   cls: 'badge-warning',  badgeBg: '#FEF3C7', badgeText: '#D97706' },
    'Düşük':  { bant: '#0D9488', emoji: '🟢', etiket: 'DÜŞÜK ÖNCELİK',  cls: 'badge-positive', badgeBg: '#CCFBF1', badgeText: '#0D9488' },
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h2 className="heading-sm" style={{ marginBottom: 16 }}>Yapay Zeka Önerileri</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {siraliOneriler.map((o) => {
          const acik = !!aciklar[o.id]
          const stil = stilMap[o.oncelik] || stilMap['Orta']
          return (
            <div key={o.id} className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: `5px solid ${stil.bant}`, minHeight: 120, transition: 'transform var(--transition-base), box-shadow var(--transition-base)' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}>
              <button onClick={() => toggle(o.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '20px 24px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', minHeight: 120 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', marginBottom: 8, display: 'inline-block', borderRadius: 20, background: stil.badgeBg, color: stil.badgeText }}>{stil.emoji} {stil.etiket}</span>
                  <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.ana_fikir}</p>
                  {o.kazanim && <p style={{ margin: '8px 0 0', fontSize: 14, fontWeight: 700, color: 'var(--color-positive)' }}>💰 {o.kazanim}</p>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: acik ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform var(--transition-base)', color: 'var(--text-tertiary)' }}><path d="M6 9l6 6 6-6" /></svg>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>{acik ? 'Kapat' : 'Detay ›'}</span>
                </div>
              </button>
              {acik && (
                <div className="animate-fade-in" style={{ padding: '0 24px 24px', borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                    {o.maddeler.map((m, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10 }}>
                        <span style={{ color: stil.bant, fontSize: 16, lineHeight: 1.4, flexShrink: 0 }}>•</span>
                        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{m}</p>
                      </div>
                    ))}
                  </div>
                  {o.kazanim && (
                    <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.2)', marginBottom: 16 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-positive)' }}>✓ Bu öneriyi uygularsan: {o.kazanim}</p>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => toggle(o.id)} className="btn btn-secondary" style={{ fontSize: 13 }}>Anladım ✓</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Alt Bileşenler ───────────────────────────────────────
function MetrikKart({ etiket, deger, renk, yon }) {
  return (
    <div className="card card-interactive" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <p className="text-tiny" style={{ margin: 0 }}>{etiket}</p>
        <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: yon === 'up' ? '#CCFBF1' : '#FFE4E6', color: yon === 'up' ? '#0D9488' : '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {yon === 'up' ? <><path d="M7 17l10-10" /><path d="M8 7h9v9" /></> : <><path d="M17 7L7 17" /><path d="M16 17H7V8" /></>}
          </svg>
        </div>
      </div>
      <div className="heading-md" style={{ color: renk, fontWeight: 700 }}>{deger}</div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div style={sayfaStil}>
      <div style={konteynerStil}>
        <div className="skeleton" style={{ height: 40, width: '40%', marginBottom: 28 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 200 }} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div className="skeleton" style={{ height: 100 }} />
          <div className="skeleton" style={{ height: 100 }} />
        </div>
        <div className="skeleton" style={{ height: 220, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 180 }} />
      </div>
    </div>
  )
}

const sayfaStil    = { minHeight: 'calc(100vh - 64px)', background: 'var(--bg-page)', padding: '32px 24px 100px' }
const konteynerStil = { maxWidth: 1200, margin: '0 auto' }
