import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useEditorStore } from '../../../core/diagram/editor/store'

interface NodeLabelInputProps {
  nodeId: string
  initial: string
  align?: 'center' | 'left'
  className?: string
}

/**
 * Editor inline (textarea) del label de un nodo. Soporta varias líneas:
 *   - Enter        → confirma (escribe data.label vía updateNodeData)
 *   - Shift+Enter  → inserta salto de línea
 *   - Escape       → cancela
 *   - blur         → confirma
 * En todos los casos baja el flag data.editing. El textarea crece en alto según
 * el contenido (auto-resize) para que las líneas extra se vean al escribir.
 */
export default function NodeLabelInput({
  nodeId,
  initial,
  align = 'center',
  className
}: NodeLabelInputProps): React.JSX.Element {
  const [value, setValue] = useState(initial)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const { updateNodeData } = useReactFlow()
  const markDirty = useEditorStore((s) => s.markDirty)
  const settledRef = useRef(false)

  useEffect(() => {
    const el = inputRef.current
    if (el) {
      el.focus()
      el.select()
    }
  }, [])

  // Auto-resize: el alto del textarea sigue al contenido (multilínea).
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  const settle = (action: 'commit' | 'cancel'): void => {
    if (settledRef.current) return
    settledRef.current = true
    if (action === 'commit') {
      // Conserva los saltos de línea internos; solo recorta espacios sobrantes
      // al principio/fin del conjunto.
      const trimmed = value.replace(/^\n+|\n+$/g, '').trim()
      if (trimmed && trimmed !== initial) {
        updateNodeData(nodeId, { label: trimmed, editing: false })
        markDirty()
      } else {
        updateNodeData(nodeId, { editing: false })
      }
    } else {
      updateNodeData(nodeId, { editing: false })
    }
  }

  return (
    <textarea
      ref={inputRef}
      className={`bachi-draw-rf-label-input ${className ?? ''}`}
      style={{ textAlign: align }}
      rows={1}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      // Evita que React Flow capture el pointer (drag) o el teclado (delete).
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter' && !e.shiftKey) {
          // Enter solo → confirmar. Shift+Enter → salto de línea (default).
          e.preventDefault()
          settle('commit')
        } else if (e.key === 'Escape') {
          e.preventDefault()
          settle('cancel')
        }
      }}
      onBlur={() => settle('commit')}
    />
  )
}
