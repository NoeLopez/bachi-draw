import { useCallback, useState } from 'react'

const STORAGE_KEY = 'bachi-draw.gridEnabled'

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export interface UseGridEnabledResult {
  gridEnabled: boolean
  toggleGrid: () => void
}

/** Preferencia persistente de la grilla de la pizarra (Excalidraw). Off por defecto. */
export function useGridEnabled(): UseGridEnabledResult {
  const [gridEnabled, setGridEnabled] = useState<boolean>(() => readStored())

  const toggleGrid = useCallback(() => {
    setGridEnabled((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        /* localStorage puede no estar disponible; no es crítico. */
      }
      return next
    })
  }, [])

  return { gridEnabled, toggleGrid }
}
