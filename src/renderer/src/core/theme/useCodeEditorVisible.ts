import { useCallback, useState } from 'react'

const STORAGE_KEY = 'bachi-draw.codeEditorVisible'

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export interface UseCodeEditorVisibleResult {
  codeEditorVisible: boolean
  toggleCodeEditor: () => void
  setCodeEditorVisible: (visible: boolean) => void
}

/** Preferencia persistente de visibilidad del editor de código .bachi. Oculto
 * por defecto. */
export function useCodeEditorVisible(): UseCodeEditorVisibleResult {
  const [codeEditorVisible, setVisible] = useState<boolean>(() => readStored())

  const persist = (next: boolean): void => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      /* localStorage puede no estar disponible; no es crítico. */
    }
  }

  const toggleCodeEditor = useCallback(() => {
    setVisible((prev) => {
      const next = !prev
      persist(next)
      return next
    })
  }, [])

  const setCodeEditorVisible = useCallback((visible: boolean) => {
    setVisible(visible)
    persist(visible)
  }, [])

  return { codeEditorVisible, toggleCodeEditor, setCodeEditorVisible }
}
