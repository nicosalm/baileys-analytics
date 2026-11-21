import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type ThemePreference = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: ThemePreference
  setTheme: (t: ThemePreference) => void
  resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'theme'

const mq = window.matchMedia('(prefers-color-scheme: dark)')

function applyTheme(pref: ThemePreference, systemDark: boolean) {
  const dark = pref === 'dark' || (pref === 'system' && systemDark)
  document.documentElement.classList.toggle('dark', dark)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
    return 'system'
  })

  // reactive: updates whenever the OS preference changes so resolvedTheme stays accurate
  const [systemDark, setSystemDark] = useState(mq.matches)

  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  // apply DOM class whenever preference or system state changes
  useEffect(() => {
    applyTheme(theme, systemDark)
  }, [theme, systemDark])

  // keep system mode in sync with OS preference changes
  useEffect(() => {
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const setTheme = (t: ThemePreference) => {
    localStorage.setItem(STORAGE_KEY, t)
    setThemeState(t)
  }

  return <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
