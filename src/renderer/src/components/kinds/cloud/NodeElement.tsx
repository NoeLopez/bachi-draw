import { useEditorStore, useIsSelected } from '../../../core/diagram/editor/store'
import type { LayoutNode } from '../../../core/parser/kinds/cloud/types'
import { getIconDataUri } from '../../../icons/registry'
import LabelEditor from './LabelEditor'

interface NodeElementProps {
  node: LayoutNode
}

const ICON_SIZE = 56
// Padding alrededor del icono y del label para el outline de selección.
const SELECTION_PAD = 4

export default function NodeElement({ node }: NodeElementProps): React.JSX.Element {
  const iconHref = getIconDataUri(node.type)
  const iconX = (node.width - ICON_SIZE) / 2
  const labelY = 2 + ICON_SIZE + 6 // justo debajo del icono, no del bounding box
  const selected = useIsSelected('node', node.id)
  const select = useEditorStore((s) => s.select)
  const mode = useEditorStore((s) => s.mode)
  const beginDrag = useEditorStore((s) => s.beginDrag)
  const beginEditLabel = useEditorStore((s) => s.beginEditLabel)
  const editing = useEditorStore((s) => s.editing?.kind === 'node' && s.editing.id === node.id)
  const connectNode = useEditorStore((s) => s.connectNode)
  const isConnectSource = useEditorStore((s) => s.connecting?.fromId === node.id)

  const handleDoubleClick = (event: React.MouseEvent<SVGGElement>): void => {
    event.stopPropagation()
    beginEditLabel('node', node.id)
  }

  const handlePointerDown = (event: React.PointerEvent<SVGGElement>): void => {
    // En modo pan dejamos pasar el evento al viewport para arrastrar el canvas.
    if (mode === 'pan') return
    event.stopPropagation()
    // Shift+click: alterna selección sin iniciar arrastre.
    if (event.shiftKey) {
      select({ kind: 'node', id: node.id }, true)
      return
    }
    if (mode === 'connect') {
      connectNode(node.id)
      return
    }
    // Click normal en modo select: si no estaba seleccionado, lo seleccionamos
    // solo a él; si ya estaba (posible multi-selección), conservamos. Luego
    // iniciamos el arrastre con la selección vigente.
    if (!selected) select({ kind: 'node', id: node.id }, false)
    beginDrag(event.clientX, event.clientY)
  }

  return (
    <g
      className={`diagen-node ${selected ? 'is-selected' : ''} ${
        isConnectSource ? 'is-connect-source' : ''
      }`}
      transform={`translate(${node.x}, ${node.y})`}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
    >
      {/* Outline de selección detrás del contenido. Solo visible cuando el
          nodo está seleccionado; engloba icono + label para feedback claro. */}
      {selected && (
        <rect
          className="diagen-selection-outline"
          x={-SELECTION_PAD}
          y={-SELECTION_PAD}
          width={node.width + SELECTION_PAD * 2}
          height={node.height + 20 + SELECTION_PAD * 2}
          rx={6}
          ry={6}
        />
      )}
      {isConnectSource && (
        <rect
          className="diagen-connect-outline"
          x={-SELECTION_PAD}
          y={-SELECTION_PAD}
          width={node.width + SELECTION_PAD * 2}
          height={node.height + 20 + SELECTION_PAD * 2}
          rx={6}
          ry={6}
        />
      )}
      <image href={iconHref} x={iconX} y={2} width={ICON_SIZE} height={ICON_SIZE} />
      {editing ? (
        <LabelEditor
          initial={node.label}
          x={-20}
          y={labelY - 3}
          width={node.width + 40}
          height={20}
          align="center"
        />
      ) : (
        <text
          className="diagen-node-label"
          x={node.width / 2}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="hanging"
        >
          {node.label}
        </text>
      )}
    </g>
  )
}
