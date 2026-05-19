import type { LayoutEdge, Point } from '../core/parser/types'

interface EdgeElementProps {
  edge: LayoutEdge
}

function r(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Construye un path SVG con líneas rectas entre los bend points calculados
 * por ELK. Con routing POLYLINE, ELK ya decide qué segmentos son verticales,
 * horizontales o diagonales — aquí solo conectamos los puntos. El suavizado
 * visual de los joins lo aporta stroke-linejoin="round" del path.
 */
function buildPath(points: Point[]): string {
  if (points.length < 2) return ''
  const [first, ...rest] = points
  const parts = [`M ${r(first.x)} ${r(first.y)}`]
  for (const p of rest) {
    parts.push(`L ${r(p.x)} ${r(p.y)}`)
  }
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
