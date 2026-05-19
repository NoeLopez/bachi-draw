import { useEffect, useMemo, useRef, useState } from 'react'
import type { LayoutResult } from '../core/parser/types'
import type { ViewportState } from '../core/renderer/viewportManager'
import ClusterElement from './ClusterElement'
import EdgeElement from './EdgeElement'
import NodeElement from './NodeElement'
import SVGViewport from './SVGViewport'

interface DiagramCanvasProps {
  layout: LayoutResult | null
  viewport: ViewportState
  onViewportChange: (next: ViewportState) => void
  onAutoFit: (containerWidth: number, containerHeight: number) => void
}

export default function DiagramCanvas({
  layout,
  viewport,
  onViewportChange,
  onAutoFit
}: DiagramCanvasProps): React.JSX.Element {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

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

  const empty = !layout

  // Las dimensiones del viewport son el bounding box del layout.
  const width = layout?.width ?? 0
  const height = layout?.height ?? 0

  const content = useMemo(() => {
    if (!layout) return null
    return (
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
      </>
    )
  }, [layout])

  return (
    <div ref={wrapperRef} className="diagen-canvas">
      {empty ? (
        <EmptyState />
      ) : (
        <SVGViewport
          width={width}
          height={height}
          viewport={viewport}
          onViewportChange={onViewportChange}
        >
          {content}
        </SVGViewport>
      )}
    </div>
  )
}

function EmptyState(): React.JSX.Element {
  return (
    <div className="diagen-empty-state">
      <div className="diagen-empty-state-card">
        <h2>Abre un archivo .arch</h2>
        <p>
          Diagen renderiza diagramas de arquitectura desde archivos YAML.
          <br />
          Usa el botón <strong>Abrir .arch…</strong> para empezar.
        </p>
        <p className="diagen-empty-hint">
          Tip: el archivo se recarga automáticamente cuando un agente lo edita.
        </p>
      </div>
    </div>
  )
}
