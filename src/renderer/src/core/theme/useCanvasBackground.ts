import { useCallback, useState } from 'react'
import type { CanvasBackground } from '../diagram/kind'

const STORAGE_KEY = 'bachi-draw.canvasBackground'

function readStored(): CanvasBackground {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === 'lines' ? 'lines' : 'dots'
  } catch {
    return 'dots'
  }
}

export interface UseCanvasBackgroundResult {
  background: CanvasBackground
  toggleBackground: () => void
}

/** Preferencia persistente del patrón de fondo (puntos / cuadrícula). */
export function useCanvasBackground(): UseCanvasBackgroundResult {
  const [background, setBackground] = useState<CanvasBackground>(() => readStored())

  const toggleBackground = useCallback(() => {
    setBackground((prev) => {
      const next: CanvasBackground = prev === 'dots' ? 'lines' : 'dots'
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        /* localStorage puede no estar disponible; no es crítico. */
      }
      return next
    })
  }, [])

  return { background, toggleBackground }
}
