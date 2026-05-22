import { Handle, type NodeProps, Position } from '@xyflow/react'
import { getIconDataUri } from '../../../icons/registry'
import type { ServiceNode as ServiceNodeType } from '../../../core/layout/kinds/cloud/toReactFlow'
import NodeLabelInput from './NodeLabelInput'

// Handles en los 4 lados. Con connectionMode="loose" en el lienzo, cada
// handle sirve como origen y destino, así las aristas se conectan por el
// lado más conveniente.
const HANDLE_SIDES = [
  { id: 't', position: Position.Top },
  { id: 'r', position: Position.Right },
  { id: 'b', position: Position.Bottom },
  { id: 'l', position: Position.Left }
] as const

export default function ServiceNode({
  id,
  data,
  selected
}: NodeProps<ServiceNodeType>): React.JSX.Element {
  const iconHref = getIconDataUri(data.iconType)
  return (
    <div className={`diagen-rf-service ${selected ? 'is-selected' : ''}`}>
      {HANDLE_SIDES.map((h) => (
        <Handle
          key={h.id}
          id={h.id}
          type="source"
          position={h.position}
          className="diagen-rf-handle"
        />
      ))}
      <img className="diagen-rf-icon" src={iconHref} alt="" draggable={false} />
      {data.editing ? (
        <div className="diagen-rf-label-wrap">
          <NodeLabelInput nodeId={id} initial={data.label} align="center" />
        </div>
      ) : (
        <div className="diagen-rf-label">{data.label}</div>
      )}
    </div>
  )
}
