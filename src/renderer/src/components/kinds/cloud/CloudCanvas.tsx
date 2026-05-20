import { useEffect, useRef, useState } from 'react'
import type { CanvasProps } from '../../../core/diagram/kind'
import { useEditorStore } from '../../../core/diagram/editor/store'
import type { LayoutResult } from '../../../core/parser/kinds/cloud/types'
import ClusterElement from './ClusterElement'
import EdgeElement from './EdgeElement'
import NodeElement from './NodeElement'
import SVGViewport from '../../shared/SVGViewport'

export default function CloudCanvas({
  layout,
  viewport,
  onViewportChange,
  onAutoFit
}: CanvasProps<LayoutResult>): React.JSX.Element {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

  // Mientras hay un drag activo, escuchamos pointermove/up globales (no en el
  // elemento) para que el arrastre continúe aunque el cursor salga del nodo.
  // El delta de pantalla se convierte a delta de canvas con el zoom actual.
  const dragActive = useEditorStore((s) => s.drag !== null)
  const updateDrag = useEditorStore((s) => s.updateDrag)
  const endDrag = useEditorStore((s) => s.endDrag)
  const zoom = viewport.zoom
  useEffect(() => {
    if (!dragActive) return
    const onMove = (e: PointerEvent): void => updateDrag(e.clientX, e.clientY, zoom)
    const onUp = (): void => endDrag()
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragActive, zoom, updateDrag, endDrag])

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      const w = entry.contentRect.width
      const h = entry.contentRect.height
      setSize({ w, h })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const layoutId = layout ? `${layout.name}|${layout.nodes.length}|${layout.edges.length}` : null
  useEffect(() => {
    if (layout && size.w > 0 && size.h > 0) {
      onAutoFit(size.w, size.h)
    }
    // Reencuadre cuando cambia el layout o cuando el contenedor cambia drásticamente de tamaño.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutId])

  // Connect tool: línea preview desde el nodo origen hasta el cursor.
  const connecting = useEditorStore((s) => s.connecting)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!connecting) return
    const el = wrapperRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setCursor({
      x: (e.clientX - rect.left - viewport.offsetX) / viewport.zoom,
      y: (e.clientY - rect.top - viewport.offsetY) / viewport.zoom
    })
  }

  // Cuando layout es null no renderizamos nada — App.tsx muestra el EmptyState
  // compartido (que es agnóstico del tipo de diagrama).
  if (!layout) return <div ref={wrapperRef} className="diagen-canvas" />

  // Las dimensiones del viewport son el bounding box del layout.
  const width = layout.width
  const height = layout.height

  // Path del preview de conexión (origen → cursor), si aplica.
  let connectPreview: React.JSX.Element | null = null
  if (connecting && cursor) {
    const src = layout.nodes.find((n) => n.id === connecting.fromId)
    if (src) {
      const cx = src.x + src.width / 2
      const cy = src.y + src.height / 2
      connectPreview = (
        <path className="diagen-connect-preview" d={`M ${cx} ${cy} L ${cursor.x} ${cursor.y}`} />
      )
    }
  }

  const content = (
    <>
      {layout.clusters.map((cluster) => (
        <ClusterElement key={cluster.id} cluster={cluster} />
      ))}
      {layout.edges.map((edge) => (
        <EdgeElement key={edge.id} edge={edge} />
      ))}
      {layout.nodes.map((node) => (
        <NodeElement key={node.id} node={node} />
      ))}
      {connectPreview}
    </>
  )

  return (
    <div ref={wrapperRef} className="diagen-canvas" onPointerMove={handlePointerMove}>
      <SVGViewport
        width={width}
        height={height}
        viewport={viewport}
        onViewportChange={onViewportChange}
      >
        {content}
      </SVGViewport>
    </div>
  )
}
