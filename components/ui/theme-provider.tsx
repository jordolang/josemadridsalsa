'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { themeStorageKey } from '@/lib/constants/theme'

type Theme = 'light' | 'dark'

type ThemeContextValue = {
  theme: Theme
  isDark: boolean
  isMounted: boolean
  setTheme: (next: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const getPreferredTheme = () => {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const stored = window.localStorage.getItem(themeStorageKey)
  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const applyThemeToDocument = (theme: Theme) => {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getPreferredTheme())
  const [isMounted, setIsMounted] = useState(false)

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(themeStorageKey, next)
    }
    applyThemeToDocument(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [setTheme, theme])

  useEffect(() => {
    applyThemeToDocument(theme)
    setIsMounted(true)
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handlePreferenceChange = (event: MediaQueryListEvent) => {
      const stored = window.localStorage.getItem(themeStorageKey)
      if (stored !== 'light' && stored !== 'dark') {
        const nextTheme: Theme = event.matches ? 'dark' : 'light'
        setThemeState(nextTheme)
        applyThemeToDocument(nextTheme)
      }
    }

    mediaQuery.addEventListener('change', handlePreferenceChange)

    return () => {
      mediaQuery.removeEventListener('change', handlePreferenceChange)
    }
  }, [setTheme])

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      isMounted,
      setTheme,
      toggleTheme,
    }),
    [theme, isMounted, setTheme, toggleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
