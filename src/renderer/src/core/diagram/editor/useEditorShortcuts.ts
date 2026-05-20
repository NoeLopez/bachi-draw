import { useEffect } from 'react'
import { useEditorStore } from './store'

/**
 * Registra atajos globales de teclado del editor.
 *
 * V / 1 → modo selección
 * H / 2 → modo pan
 * A / 3 → modo conectar
 * Escape → vaciar selección
 *
 * Los atajos se ignoran si el foco está dentro de un input/textarea o de
 * un contentEditable para no interferir con la edición inline de labels.
 */
export function useEditorShortcuts(): void {
  const setMode = useEditorStore((s) => s.setMode)
  const clearSelection = useEditorStore((s) => s.clearSelection)

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if (target.isContentEditable) return true
      return false
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      // Ignorar si hay modificadores (para no robar Cmd+V etc) o foco editable.
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isEditableTarget(event.target)) return

      const k = event.key.toLowerCase()
      if (k === 'v' || k === '1') {
        setMode('select')
        event.preventDefault()
      } else if (k === 'h' || k === '2') {
        setMode('pan')
        event.preventDefault()
      } else if (k === 'a' || k === '3') {
        setMode('connect')
        event.preventDefault()
      } else if (k === 'escape') {
        clearSelection()
        event.preventDefault()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setMode, clearSelection])
}
