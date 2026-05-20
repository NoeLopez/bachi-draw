import { useEditorStore, useIsSelected } from '../../../core/diagram/editor/store'
import type { LayoutEdge, Point } from '../../../core/parser/kinds/cloud/types'

interface EdgeElementProps {
  edge: LayoutEdge
}

// Radio de las esquinas redondeadas en los bend points del routing ortogonal.
const CORNER_R = 5

function r(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Construye un path SVG ortogonal con esquinas redondeadas. Cada bend point
 * intermedio se reemplaza por una pequeña curva Bezier cuadrática que suaviza
 * el ángulo recto. Los segmentos siguen siendo estrictamente horizontales o
 * verticales — solo las esquinas tienen una diagonal corta curva.
 */
function buildPath(points: Point[]): string {
  if (points.length < 2) return ''

  const first = points[0]
  const last = points[points.length - 1]
  const parts: string[] = [`M ${r(first.x)} ${r(first.y)}`]

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    const next = points[i + 1]

    const dx1 = cur.x - prev.x
    const dy1 = cur.y - prev.y
    const len1 = Math.hypot(dx1, dy1)
    const dx2 = next.x - cur.x
    const dy2 = next.y - cur.y
    const len2 = Math.hypot(dx2, dy2)

    if (len1 < 0.01 || len2 < 0.01) {
      parts.push(`L ${r(cur.x)} ${r(cur.y)}`)
      continue
    }

    const radius = Math.min(CORNER_R, len1 / 2, len2 / 2)
    const bx = cur.x - (dx1 / len1) * radius
    const by = cur.y - (dy1 / len1) * radius
    const ax = cur.x + (dx2 / len2) * radius
    const ay = cur.y + (dy2 / len2) * radius

    parts.push(`L ${r(bx)} ${r(by)}`)
    parts.push(`Q ${r(cur.x)} ${r(cur.y)} ${r(ax)} ${r(ay)}`)
  }

  parts.push(`L ${r(last.x)} ${r(last.y)}`)
  return parts.join(' ')
}

export default function EdgeElement({ edge }: EdgeElementProps): React.JSX.Element | null {
  // Hooks SIEMPRE antes de cualquier early-return para cumplir las reglas
  // de React.
  const selected = useIsSelected('edge', edge.id)
  const select = useEditorStore((s) => s.select)

  if (edge.points.length < 2) return null

  const d = buildPath(edge.points)
  const markerEnd = edge.direction === 'back' ? undefined : 'url(#diagen-arrowhead)'
  const markerStart =
    edge.direction === 'back' || edge.direction === 'both'
      ? 'url(#diagen-arrowhead-start)'
      : undefined

  const labelPos = edge.labelPosition
  const labelWidth = edge.label ? Math.max(28, edge.label.length * 6.5) + 8 : 0

  const handlePointerDown = (event: React.PointerEvent<SVGGElement>): void => {
    event.stopPropagation()
    select({ kind: 'edge', id: edge.id }, event.shiftKey)
  }

  return (
    <g
      className={`diagen-edge diagen-edge-${edge.style} ${selected ? 'is-selected' : ''}`}
      onPointerDown={handlePointerDown}
    >
      {/* Hit area transparente: stroke grueso invisible para facilitar el
          click; el path delgado real va encima. Sin esto los edges de 1.6px
          son casi imposibles de clickear. */}
      <path
        className="diagen-edge-hit"
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        className="diagen-edge-path"
        d={d}
        fill="none"
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={edge.style === 'dashed' ? '6 4' : undefined}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
      {edge.label && labelPos && (
        <g transform={`translate(${labelPos.x}, ${labelPos.y})`}>
          <rect
            className="diagen-edge-label-bg"
            x={-labelWidth / 2}
            y={-9}
            width={labelWidth}
            height={18}
            rx={4}
            ry={4}
            strokeWidth={1}
          />
          <text className="diagen-edge-label" textAnchor="middle" dominantBaseline="central">
            {edge.label}
          </text>
        </g>
      )}
    </g>
  )
}
