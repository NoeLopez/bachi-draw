import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../../../core/diagram/editor/store'

interface LabelEditorProps {
  /** Valor inicial del label. */
  initial: string
  /** Geometría del input en coordenadas del <g> contenedor. */
  x: number
  y: number
  width: number
  height: number
  /** Alineación del texto dentro del input. */
  align?: 'center' | 'left'
}

/**
 * Editor inline de label. Se monta dentro del <g> de un nodo/cluster como un
 * foreignObject con un <input> HTML. Confirma con Enter o blur; cancela con
 * Escape. La confirmación/cancelación se delega al store.
 */
export default function LabelEditor({
  initial,
  x,
  y,
  width,
  height,
  align = 'center'
}: LabelEditorProps): React.JSX.Element {
  const [value, setValue] = useState(initial)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const commit = useEditorStore((s) => s.commitEditLabel)
  const cancel = useEditorStore((s) => s.cancelEditLabel)
  // Evita doble commit (Enter dispara blur que volvería a commitear).
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
    if (action === 'commit') commit(value)
    else cancel()
  }

  return (
    <foreignObject x={x} y={y} width={width} height={height}>
      <input
        ref={inputRef}
        className="diagen-label-input"
        style={{ textAlign: align }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
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
    </foreignObject>
  )
}
