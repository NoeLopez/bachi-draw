import type { CloudEdgeData, CloudFlowNode } from '../../../core/layout/kinds/cloud/toReactFlow'
import type { Edge } from '@xyflow/react'

// ──────────────────────────────────────────────────────────────────────────
// Panel lateral derecho (inspector contextual). Presentacional: recibe el
// elemento seleccionado y los callbacks; no toca React Flow directamente. La
// lectura de selección y las acciones viven en CloudCanvas (el padre).
// ──────────────────────────────────────────────────────────────────────────

type EdgeStyle = 'solid' | 'dashed'
type EdgeDirection = 'forward' | 'back' | 'both'

interface Props {
  node: CloudFlowNode | null
  edge: Edge<CloudEdgeData> | null
  onEditConnectionPoints: (nodeId: string) => void
  onToggleJumps: (edgeId: string) => void
  onSetEdgeStyle: (edgeId: string, style: EdgeStyle) => void
  onSetEdgeDirection: (edgeId: string, direction: EdgeDirection) => void
}

// ── Iconos ──────────────────────────────────────────────────────────────────

const IconConnectionPoints = (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <rect
      x="4"
      y="4"
      width="8"
      height="8"
      rx="1.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
    />
    <g fill="currentColor">
      <circle cx="8" cy="2" r="1.3" />
      <circle cx="8" cy="14" r="1.3" />
      <circle cx="2" cy="8" r="1.3" />
      <circle cx="14" cy="8" r="1.3" />
    </g>
  </svg>
)

const IconJump = (
  <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
    <path
      d="M1 10 H6 A3 3 0 0 1 12 10 H17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
)

const IconSolid = (
  <svg width="20" height="12" viewBox="0 0 20 12" aria-hidden="true">
    <line
      x1="2"
      y1="6"
      x2="18"
      y2="6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
)

const IconDashed = (
  <svg width="20" height="12" viewBox="0 0 20 12" aria-hidden="true">
    <line
      x1="2"
      y1="6"
      x2="18"
      y2="6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeDasharray="4 3"
    />
  </svg>
)

export default function CloudInspector({
  node,
  edge,
  onEditConnectionPoints,
  onToggleJumps,
  onSetEdgeStyle,
  onSetEdgeDirection
}: Props): React.JSX.Element | null {
  if (!node && !edge) return null

  return (
    <aside className="bachi-draw-inspector">
      {node ? <NodeInspector node={node} onEditConnectionPoints={onEditConnectionPoints} /> : null}
      {edge ? (
        <EdgeInspector
          edge={edge}
          onToggleJumps={onToggleJumps}
          onSetEdgeStyle={onSetEdgeStyle}
          onSetEdgeDirection={onSetEdgeDirection}
        />
      ) : null}
    </aside>
  )
}

function NodeInspector({
  node,
  onEditConnectionPoints
}: {
  node: CloudFlowNode
  onEditConnectionPoints: (nodeId: string) => void
}): React.JSX.Element {
  return (
    <>
      <header className="bachi-draw-inspector-head">
        <span className="bachi-draw-inspector-kind">Nodo</span>
        <span className="bachi-draw-inspector-name">{node.data.label}</span>
      </header>

      <section className="bachi-draw-inspector-section">
        <h4 className="bachi-draw-inspector-title">Conexiones</h4>
        <button
          type="button"
          className="bachi-draw-inspector-row"
          title="Añadir o quitar puntos de conexión del nodo"
          onClick={() => onEditConnectionPoints(node.id)}
        >
          <span className="bachi-draw-inspector-ico">{IconConnectionPoints}</span>
          Editar puntos de conexión
        </button>
      </section>
    </>
  )
}

function EdgeInspector({
  edge,
  onToggleJumps,
  onSetEdgeStyle,
  onSetEdgeDirection
}: {
  edge: Edge<CloudEdgeData>
  onToggleJumps: (edgeId: string) => void
  onSetEdgeStyle: (edgeId: string, style: EdgeStyle) => void
  onSetEdgeDirection: (edgeId: string, direction: EdgeDirection) => void
}): React.JSX.Element {
  const style = edge.data?.style ?? 'solid'
  const direction = edge.data?.direction ?? 'forward'
  const jumps = edge.data?.jumps === true

  return (
    <>
      <header className="bachi-draw-inspector-head">
        <span className="bachi-draw-inspector-kind">Flecha</span>
        <span className="bachi-draw-inspector-name">
          {(edge.label as string) || 'sin etiqueta'}
        </span>
      </header>

      <section className="bachi-draw-inspector-section">
        <h4 className="bachi-draw-inspector-title">Estilo</h4>
        <div className="bachi-draw-inspector-segmented">
          <button
            type="button"
            className={style === 'solid' ? 'is-active' : ''}
            title="Línea sólida"
            onClick={() => onSetEdgeStyle(edge.id, 'solid')}
          >
            {IconSolid}
          </button>
          <button
            type="button"
            className={style === 'dashed' ? 'is-active' : ''}
            title="Línea punteada"
            onClick={() => onSetEdgeStyle(edge.id, 'dashed')}
          >
            {IconDashed}
          </button>
        </div>
      </section>

      <section className="bachi-draw-inspector-section">
        <h4 className="bachi-draw-inspector-title">Dirección</h4>
        <div className="bachi-draw-inspector-segmented">
          <button
            type="button"
            className={direction === 'forward' ? 'is-active' : ''}
            title="Hacia el destino"
            onClick={() => onSetEdgeDirection(edge.id, 'forward')}
          >
            →
          </button>
          <button
            type="button"
            className={direction === 'back' ? 'is-active' : ''}
            title="Hacia el origen"
            onClick={() => onSetEdgeDirection(edge.id, 'back')}
          >
            ←
          </button>
          <button
            type="button"
            className={direction === 'both' ? 'is-active' : ''}
            title="Bidireccional"
            onClick={() => onSetEdgeDirection(edge.id, 'both')}
          >
            ↔
          </button>
        </div>
      </section>

      <section className="bachi-draw-inspector-section">
        <h4 className="bachi-draw-inspector-title">Saltos de línea</h4>
        <button
          type="button"
          className={`bachi-draw-inspector-row ${jumps ? 'is-active' : ''}`}
          title="Dibuja un arco donde esta flecha cruza a otras"
          onClick={() => onToggleJumps(edge.id)}
        >
          <span className="bachi-draw-inspector-ico">{IconJump}</span>
          {jumps ? 'Quitar saltos' : 'Saltar las flechas que cruza'}
        </button>
      </section>
    </>
  )
}
