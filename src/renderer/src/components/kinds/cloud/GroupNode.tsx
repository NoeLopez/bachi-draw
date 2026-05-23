import { type NodeProps } from '@xyflow/react'
import type { GroupNode as GroupNodeType } from '../../../core/layout/kinds/cloud/toReactFlow'
import NodeLabelInput from './NodeLabelInput'

/**
 * Nodo contenedor (cluster). Ocupa todo el ancho/alto declarado y muestra el
 * label arriba a la izquierda. El borde dashed indica el límite del grupo.
 * El interior es transparente a los eventos salvo el propio borde/label, para
 * que los nodos hijos sigan siendo interactuables.
 */
export default function GroupNode({
  id,
  data,
  selected
}: NodeProps<GroupNodeType>): React.JSX.Element {
  return (
    <div className={`bachi-draw-rf-group ${selected ? 'is-selected' : ''}`}>
      {data.editing ? (
        <div className="bachi-draw-rf-group-label-wrap">
          <NodeLabelInput nodeId={id} initial={data.label} align="left" />
        </div>
      ) : (
        <div className="bachi-draw-rf-group-label">{data.label}</div>
      )}
    </div>
  )
}
