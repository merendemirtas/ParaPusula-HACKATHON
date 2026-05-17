/**
 * ParaPusula - API Servis Katmanı
 * Backend ile tüm HTTP iletişimi buradan yönetilir.
 */

import axios from 'axios'

// Axios instance - tüm isteklere baseURL ekler
const api = axios.create({
  baseURL: '/api',
  timeout: 60000, // 60 saniye (AI işlemleri uzun sürebilir)
  headers: {
    'Content-Type': 'application/json',
  },
})

// İstek interceptor - her isteği logla (geliştirme için)
api.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => Promise.reject(error)
)

// Yanıt interceptor - hata yönetimi
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const mesaj = error.response?.data?.detail || error.message || 'Bilinmeyen hata'
    console.error(`[API] Hata: ${mesaj}`)
    return Promise.reject(new Error(mesaj))
  }
)

// ─────────────────────────────────────────────
// Onboarding
// ─────────────────────────────────────────────

/**
 * Kullanıcı onboarding formunu gönderir ve profil oluşturur.
 * @param {Object} data - { user_id, gelir_duzeni, mevcut_durum, ana_hedef, harcama_aliskanligi }
 * @returns {Promise<Object>} - { basarili, user_id, mesaj }
 */
export async function onboarding(data) {
  const yanit = await api.post('/onboarding', data)
  return yanit.data
}

// ─────────────────────────────────────────────
// PDF Yükleme
// ─────────────────────────────────────────────

/**
 * PDF banka ekstresini yükler ve analiz başlatır.
 * @param {File} file - PDF dosyası
 * @param {string} userId - Kullanıcı kimliği
 * @param {string} banka - "Ziraat" veya "Halkbank"
 * @returns {Promise<Object>} - { job_id, durum, mesaj }
 */
export async function uploadPDF(file, userId, banka = 'Ziraat') {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('user_id', userId)
  formData.append('banka', banka)

  const yanit = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000, // 5 dakika — Gemini 2.5 Flash işleme süresi
  })
  return yanit.data
}

// ─────────────────────────────────────────────
// Analiz
// ─────────────────────────────────────────────

/**
 * Kullanıcının en son finansal analizini getirir.
 * @param {string} userId - Kullanıcı kimliği
 * @returns {Promise<Object>} - FinancialSnapshot
 */
export async function getAnalysis(userId) {
  const yanit = await api.get(`/analysis/${userId}`)
  return yanit.data
}

/**
 * Kullanıcının finansal sağlık skorunu getirir.
 * @param {string} userId - Kullanıcı kimliği
 * @returns {Promise<Object>} - { finansal_skor, ay, yorum, ... }
 */
export async function getHealthScore(userId) {
  const yanit = await api.get(`/health-score/${userId}`)
  return yanit.data
}

// ─────────────────────────────────────────────
// Sohbet
// ─────────────────────────────────────────────

/**
 * AI finansal asistana mesaj gönderir.
 * @param {string} userId - Kullanıcı kimliği
 * @param {string} mesaj - Kullanıcının sorusu
 * @returns {Promise<Object>} - { yanit, user_id }
 */
export async function chat(userId, mesaj) {
  const yanit = await api.post('/chat', { user_id: userId, mesaj })
  return yanit.data
}

// ─────────────────────────────────────────────
// TCMB
// ─────────────────────────────────────────────

/**
 * TCMB verilerini yeniler ve güncel makroekonomik veriyi döndürür.
 * @returns {Promise<Object>} - TCMBData
 */
/**
 * Mevcut snapshot'ı yeni algoritmayla yeniden hesaplar (PDF gerektirmez).
 * @param {string} userId
 */
export async function recalculate(userId) {
  const yanit = await api.post(`/recalculate/${userId}`)
  return yanit.data
}

export async function refreshTCMB() {
  const yanit = await api.get('/tcmb/refresh')
  return yanit.data
}

/**
 * Mevcut TCMB verisini döndürür (cache öncelikli).
 * @returns {Promise<Object>} - TCMBData
 */
export async function getCurrentTCMB() {
  const yanit = await api.get('/tcmb/current')
  return yanit.data
}

export default api
