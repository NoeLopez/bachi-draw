import { Handle, type NodeProps, Position } from '@xyflow/react'
import { getIconDataUri } from '../../../icons/registry'
import type { ServiceNode as ServiceNodeType } from '../../../core/layout/kinds/cloud/toReactFlow'
import NodeLabelInput from './NodeLabelInput'

// Modelo estilo Lucid: 4 handles VISIBLES, uno centrado en cada lado (ids
// t/r/b/l, los que ya usaban las aristas guardadas). Son los "imanes" cómodos
// para tirar una flecha y para engancharla limpia. Con connectionMode="loose"
// cada uno sirve como origen y destino.
const SIDES = [
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
      {SIDES.map((h) => (
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
