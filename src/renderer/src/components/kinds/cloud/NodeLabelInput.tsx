import { useEffect, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useEditorStore } from '../../../core/diagram/editor/store'

interface NodeLabelInputProps {
  nodeId: string
  initial: string
  align?: 'center' | 'left'
  className?: string
}

/**
 * Input inline para editar el label de un nodo de React Flow. Confirma con
 * Enter o blur (escribe en data.label vía updateNodeData), cancela con Escape.
 * En ambos casos baja el flag data.editing.
 */
export default function NodeLabelInput({
  nodeId,
  initial,
  align = 'center',
  className
}: NodeLabelInputProps): React.JSX.Element {
  const [value, setValue] = useState(initial)
  const inputRef = useRef<HTMLInputElement | null>(null)
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

  const settle = (action: 'commit' | 'cancel'): void => {
    if (settledRef.current) return
    settledRef.current = true
    if (action === 'commit') {
      const trimmed = value.trim()
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
    <input
      ref={inputRef}
      className={`diagen-rf-label-input ${className ?? ''}`}
      style={{ textAlign: align }}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      // Evita que React Flow capture el pointer (drag) o el teclado (delete).
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') {
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
