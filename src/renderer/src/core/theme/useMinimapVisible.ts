import { useCallback, useState } from 'react'

const STORAGE_KEY = 'bachi-draw.minimapVisible'

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export interface UseMinimapVisibleResult {
  minimapVisible: boolean
  toggleMinimap: () => void
}

/** Preferencia persistente de visibilidad del minimapa. Oculto por defecto. */
export function useMinimapVisible(): UseMinimapVisibleResult {
  const [minimapVisible, setMinimapVisible] = useState<boolean>(() => readStored())

  const toggleMinimap = useCallback(() => {
    setMinimapVisible((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        /* localStorage puede no estar disponible; no es crítico. */
      }
      return next
    })
  }, [])

  return { minimapVisible, toggleMinimap }
}
