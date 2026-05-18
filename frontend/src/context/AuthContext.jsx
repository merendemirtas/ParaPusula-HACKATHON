// Firebase Auth durumunu tüm uygulamaya yayan context
// KARAR: Token refresh Firebase SDK tarafından otomatik yapılır (1 saatlik JWT, 48 saatlik refresh token).
import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signOut,
} from 'firebase/auth'
import { auth } from '../firebase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [kullanici, setKullanici] = useState(undefined) // undefined = henüz yüklenmedi
  const [yukleniyor, setYukleniyor] = useState(true)

  useEffect(() => {
    // Firebase auth durumunu dinle
    const abonelikIptal = onAuthStateChanged(auth, (user) => {
      setKullanici(user)
      setYukleniyor(false)

      // Geriye dönük uyumluluk: localStorage'ı Firebase uid ile güncelle
      if (user) {
        localStorage.setItem('parapusula_user_id', user.uid)
      } else {
        localStorage.removeItem('parapusula_user_id')
      }
    })

    return () => abonelikIptal()
  }, [])

  async function cikisYap() {
    await signOut(auth)
    localStorage.removeItem('parapusula_user_id')
  }

  const deger = {
    kullanici,
    yukleniyor,
    cikisYap,
  }

  return (
    <AuthContext.Provider value={deger}>
      {children}
    </AuthContext.Provider>
  )
}

// Kolay erişim için hook
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth, AuthProvider içinde kullanılmalıdır')
  }
  return context
}
