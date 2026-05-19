import type { LayoutEdge, Point } from '../core/parser/types'

interface EdgeElementProps {
  edge: LayoutEdge
}

const CORNER_R = 5

function r(n: number): number {
  return Math.round(n * 10) / 10
}

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
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1)
    const dx2 = next.x - cur.x
    const dy2 = next.y - cur.y
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)

    if (len1 < 0.01 || len2 < 0.01) {
      parts.push(`L ${r(cur.x)} ${r(cur.y)}`)
      continue
    }

    const radius = Math.min(CORNER_R, len1 / 2, len2 / 2)
    // Punto justo antes de la esquina
    const bx = cur.x - (dx1 / len1) * radius
    const by = cur.y - (dy1 / len1) * radius
    // Punto justo después de la esquina
    const ax = cur.x + (dx2 / len2) * radius
    const ay = cur.y + (dy2 / len2) * radius

    parts.push(`L ${r(bx)} ${r(by)}`)
    parts.push(`Q ${r(cur.x)} ${r(cur.y)} ${r(ax)} ${r(ay)}`)
  }

  parts.push(`L ${r(last.x)} ${r(last.y)}`)
  return parts.join(' ')
}

export default function EdgeElement({ edge }: EdgeElementProps): React.JSX.Element | null {
  if (edge.points.length < 2) return null

  const d = buildPath(edge.points)
  const markerEnd = edge.direction === 'back' ? undefined : 'url(#diagen-arrowhead)'
  const markerStart =
    edge.direction === 'back' || edge.direction === 'both'
      ? 'url(#diagen-arrowhead-start)'
      : undefined

  const labelPos = edge.labelPosition
  const labelWidth = edge.label ? Math.max(28, edge.label.length * 6.5) + 8 : 0

  return (
    <g className={`diagen-edge diagen-edge-${edge.style}`}>
      <path
        className="diagen-edge-path"
        d={d}
        fill="none"
        strokeWidth={1.6}
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
