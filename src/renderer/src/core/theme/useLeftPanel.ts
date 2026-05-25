import { useCallback, useState } from 'react'

const STORAGE_KEY = 'bachi-draw.leftPanel'

/**
 * Panel activo en el muelle izquierdo de un diagrama cloud. Es un único hueco:
 * las figuras y el editor de código son mutuamente excluyentes (abrir uno cierra
 * el otro) para no apilar dos columnas y dejar más espacio al lienzo. `none`
 * deja el muelle vacío.
 */
export type LeftPanel = 'figures' | 'code' | 'none'

function readStored(): LeftPanel {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === 'figures' || v === 'code' || v === 'none') return v
  } catch {
    /* localStorage puede no estar disponible. */
  }
  // Por defecto, un diagrama abre con las figuras a mano.
  return 'figures'
}

export interface UseLeftPanelResult {
  leftPanel: LeftPanel
  setLeftPanel: (panel: LeftPanel) => void
  /** Alterna las figuras: si ya están activas las cierra, si no las muestra. */
  toggleFigures: () => void
  /** Alterna el editor de código (mismo hueco que las figuras). */
  toggleCode: () => void
}

export function useLeftPanel(): UseLeftPanelResult {
  const [leftPanel, setPanel] = useState<LeftPanel>(() => readStored())

  const persist = (next: LeftPanel): void => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* no crítico */
    }
  }

  const setLeftPanel = useCallback((panel: LeftPanel) => {
    setPanel(panel)
    persist(panel)
  }, [])

  const toggleFigures = useCallback(() => {
    setPanel((prev) => {
      const next: LeftPanel = prev === 'figures' ? 'none' : 'figures'
      persist(next)
      return next
    })
  }, [])

  const toggleCode = useCallback(() => {
    setPanel((prev) => {
      const next: LeftPanel = prev === 'code' ? 'none' : 'code'
      persist(next)
      return next
    })
  }, [])

  return { leftPanel, setLeftPanel, toggleFigures, toggleCode }
}
