import { useEffect, useRef, useState } from 'react'
import type { CanvasProps } from '../../../core/diagram/kind'
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

  // Cuando layout es null no renderizamos nada — App.tsx muestra el EmptyState
  // compartido (que es agnóstico del tipo de diagrama).
  if (!layout) return <div ref={wrapperRef} className="diagen-canvas" />

  // Las dimensiones del viewport son el bounding box del layout.
  const width = layout.width
  const height = layout.height

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
    </>
  )

  return (
    <div ref={wrapperRef} className="diagen-canvas">
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
