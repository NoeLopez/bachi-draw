import { useEditorStore, useIsSelected } from '../../../core/diagram/editor/store'
import type { LayoutCluster } from '../../../core/parser/kinds/cloud/types'

interface ClusterElementProps {
  cluster: LayoutCluster
}

export default function ClusterElement({ cluster }: ClusterElementProps): React.JSX.Element {
  const selected = useIsSelected('cluster', cluster.id)
  const select = useEditorStore((s) => s.select)
  const mode = useEditorStore((s) => s.mode)
  const beginDrag = useEditorStore((s) => s.beginDrag)

  // Hit detection: solo el borde y el label son clickeables; el interior no
  // captura eventos (para que clicks en el área del cluster lleguen a los
  // nodos hijos). Al arrastrar un cluster se mueven todos sus descendientes.
  const handlePointerDown = (event: React.PointerEvent<SVGElement>): void => {
    if (mode === 'pan') return
    event.stopPropagation()
    if (event.shiftKey) {
      select({ kind: 'cluster', id: cluster.id }, true)
      return
    }
    if (mode === 'connect') {
      select({ kind: 'cluster', id: cluster.id }, false)
      return
    }
    if (!selected) select({ kind: 'cluster', id: cluster.id }, false)
    beginDrag(event.clientX, event.clientY)
  }

  return (
    <g
      className={`diagen-cluster ${selected ? 'is-selected' : ''}`}
      transform={`translate(${cluster.x}, ${cluster.y})`}
    >
      <rect
        className="diagen-cluster-rect"
        x={0}
        y={0}
        width={cluster.width}
        height={cluster.height}
        rx={10}
        ry={10}
        strokeDasharray="4 4"
        strokeWidth={1}
        pointerEvents="none"
      />
      {/* Borde sensible al click: contorno transparente y grueso encima del
          rect visual. Los nodos hijos siguen recibiendo eventos en el interior. */}
      <rect
        className="diagen-cluster-hit"
        x={0}
        y={0}
        width={cluster.width}
        height={cluster.height}
        rx={10}
        ry={10}
        fill="none"
        stroke="transparent"
        strokeWidth={10}
        onPointerDown={handlePointerDown}
      />
      {selected && (
        <rect
          className="diagen-selection-outline"
          x={-2}
          y={-2}
          width={cluster.width + 4}
          height={cluster.height + 4}
          rx={12}
          ry={12}
          pointerEvents="none"
        />
      )}
      <text
        className="diagen-cluster-label"
        x={14}
        y={20}
        dominantBaseline="middle"
        onPointerDown={handlePointerDown}
      >
        {cluster.label}
      </text>
    </g>
  )
}
