import { ReactNode, useCallback, useRef, useState } from 'react'
import {
  fitToContainer,
  pan,
  type ViewportState,
  zoomAtPoint
} from '../../core/renderer/viewportManager'

interface SVGViewportProps {
  width: number
  height: number
  viewport: ViewportState
  onViewportChange: (next: ViewportState) => void
  children: ReactNode
}

export default function SVGViewport({
  width,
  height,
  viewport,
  onViewportChange,
  children
}: SVGViewportProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; viewport: ViewportState } | null>(null)
  const [isPanning, setIsPanning] = useState(false)

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      const container = containerRef.current
      if (!container) return
      event.preventDefault()
      const rect = container.getBoundingClientRect()
      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top
      const factor = Math.exp(-event.deltaY * 0.0015)
      onViewportChange(zoomAtPoint(viewport, factor, pointerX, pointerY))
    },
    [onViewportChange, viewport]
  )

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 && event.button !== 1) return
      const target = event.currentTarget
      target.setPointerCapture(event.pointerId)
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        viewport
      }
      setIsPanning(true)
    },
    [viewport]
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag) return
      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY
      onViewportChange(pan(drag.viewport, dx, dy))
    },
    [onViewportChange]
  )

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      event.currentTarget.releasePointerCapture(event.pointerId)
      dragRef.current = null
      setIsPanning(false)
    }
  }, [])

  // Permitir doble-click para resetear el zoom al fit del contenido.
  const handleDoubleClick = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    onViewportChange(fitToContainer(width, height, rect.width, rect.height))
  }, [height, onViewportChange, width])

  return (
    <div
      ref={containerRef}
      className={`diagen-viewport ${isPanning ? 'is-panning' : ''}`}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      <svg className="diagen-svg" width="100%" height="100%">
        <defs>
          <marker
            id="diagen-arrowhead"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerUnits="strokeWidth"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 Z" className="diagen-arrow-marker" />
          </marker>
          <marker
            id="diagen-arrowhead-start"
            viewBox="0 0 10 10"
            refX="1"
            refY="5"
            markerUnits="strokeWidth"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M10,0 L0,5 L10,10 Z" className="diagen-arrow-marker" />
          </marker>
        </defs>
        <g
          transform={`translate(${viewport.offsetX}, ${viewport.offsetY}) scale(${viewport.zoom})`}
        >
          {children}
        </g>
      </svg>
    </div>
  )
}
