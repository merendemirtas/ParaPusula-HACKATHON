import React, { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext({ tema: 'light', temaDegistir: () => {} })

export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(() => {
    const sakli = localStorage.getItem('parapusula-theme')
    if (sakli) return sakli
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
    return 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema)
    localStorage.setItem('parapusula-theme', tema)
  }, [tema])

  function temaDegistir() {
    setTema(prev => prev === 'dark' ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider value={{ tema, temaDegistir }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
