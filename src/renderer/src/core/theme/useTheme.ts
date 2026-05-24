import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'bachi-draw.theme'

function readStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}

export interface UseThemeResult {
  theme: Theme
  /** true cuando el tema actual sigue al sistema (no hay override del usuario). */
  followsSystem: boolean
  toggleTheme: () => void
  resetToSystem: () => void
}

export function useTheme(): UseThemeResult {
  const [stored, setStored] = useState<Theme | null>(() => readStoredTheme())
  const [system, setSystem] = useState<Theme>(() => systemTheme())

  const theme: Theme = stored ?? system
  const followsSystem = stored === null

  // Aplica el atributo al <html> en cada cambio. Se ejecuta también en el
  // primer render para que el SSR (o el HTML inicial) quede sincronizado.
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Sincroniza la apariencia NATIVA de la ventana con el tema. macOS dibuja los
  // semáforos según esa apariencia; si el usuario fuerza un tema distinto al del
  // SO, los botones quedan sin contraste. Con 'system' (sin override) la ventana
  // sigue al SO; con override forzamos 'light'/'dark' para que coincidan.
  useEffect(() => {
    const source = stored ?? 'system'
    window.bachiDraw?.setNativeTheme?.(source)?.catch(() => {})
  }, [stored])

  // Escucha cambios de preferencia del sistema mientras no haya override.
  useEffect(() => {
    const mql = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mql) return
    const handler = (e: MediaQueryListEvent): void => setSystem(e.matches ? 'dark' : 'light')
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* localStorage puede no estar disponible (ej. sandbox); no es crítico. */
    }
    setStored(next)
  }, [theme])

  const resetToSystem = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignorar */
    }
    setStored(null)
  }, [])

  return { theme, followsSystem, toggleTheme, resetToSystem }
}
