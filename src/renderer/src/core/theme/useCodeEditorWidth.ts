import { useCallback, useState } from 'react'

const STORAGE_KEY = 'bachi-draw.codeEditorWidth'
export const CODE_MIN_WIDTH = 280
export const CODE_MAX_WIDTH = 760
const DEFAULT_WIDTH = 420

function clamp(w: number): number {
  return Math.min(CODE_MAX_WIDTH, Math.max(CODE_MIN_WIDTH, Math.round(w)))
}

function readStored(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw == null) return DEFAULT_WIDTH
    const n = Number.parseInt(raw, 10)
    return Number.isFinite(n) ? clamp(n) : DEFAULT_WIDTH
  } catch {
    return DEFAULT_WIDTH
  }
}

export interface UseCodeEditorWidthResult {
  width: number
  setWidth: (w: number) => void
}

/** Ancho persistente del panel del editor de código (px), con límites. */
export function useCodeEditorWidth(): UseCodeEditorWidthResult {
  const [width, setWidthState] = useState<number>(() => readStored())

  const setWidth = useCallback((w: number) => {
    const next = clamp(w)
    setWidthState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      /* localStorage puede no estar disponible; no es crítico. */
    }
  }, [])

  return { width, setWidth }
}
