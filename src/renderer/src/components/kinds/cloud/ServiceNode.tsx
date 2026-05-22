import { type CSSProperties, useEffect } from 'react'
import { Handle, type NodeProps, Position, useUpdateNodeInternals } from '@xyflow/react'
import { getIconDataUri } from '../../../icons/registry'
import type { ServiceNode as ServiceNodeType } from '../../../core/layout/kinds/cloud/toReactFlow'
import {
  extraHandleId,
  extraHandlePositions,
  SIDES as EXTRA_SIDES,
  type Side
} from '../../../core/layout/kinds/cloud/connectionHandles'
import NodeLabelInput from './NodeLabelInput'

// 4 imanes centrales VISIBLES (ids t/r/b/l, los que usan las aristas guardadas).
// Con connectionMode="loose" cada uno sirve como origen y destino.
const SIDES = [
  { id: 't', position: Position.Top },
  { id: 'r', position: Position.Right },
  { id: 'b', position: Position.Bottom },
  { id: 'l', position: Position.Left }
] as const

// Mapa lado → Position de React Flow y eje de offset para los puntos extra.
const SIDE_META: Record<Side, { position: Position; axis: 'x' | 'y' }> = {
  top: { position: Position.Top, axis: 'x' },
  right: { position: Position.Right, axis: 'y' },
  bottom: { position: Position.Bottom, axis: 'x' },
  left: { position: Position.Left, axis: 'y' }
}

export default function ServiceNode({
  id,
  data,
  selected
}: NodeProps<ServiceNodeType>): React.JSX.Element {
  const iconHref = getIconDataUri(data.iconType)
  const extra = data.extraHandles
  const updateNodeInternals = useUpdateNodeInternals()

  // Cuando cambia la config de puntos extra, React Flow debe recalcular los
  // bounds de los handles; sin esto los handles nuevos se dibujan pero su área
  // de conexión queda desactualizada (no se puede iniciar ni soltar en ellos).
  const extraKey = extra
    ? `${extra.top ?? 0}-${extra.right ?? 0}-${extra.bottom ?? 0}-${extra.left ?? 0}`
    : ''
  useEffect(() => {
    updateNodeInternals(id)
  }, [id, extraKey, updateNodeInternals])

  return (
    <div className={`diagen-rf-service ${selected ? 'is-selected' : ''}`}>
      {/* 4 imanes centrales */}
      {SIDES.map((h) => (
        <Handle
          key={h.id}
          id={h.id}
          type="source"
          position={h.position}
          className="diagen-rf-handle"
        />
      ))}
      {/* Puntos extra por lado, repartidos proporcionalmente. */}
      {extra
        ? EXTRA_SIDES.flatMap((side) => {
            const count = extra[side] ?? 0
            const meta = SIDE_META[side]
            return extraHandlePositions(count).map((pct, i) => {
              const style: CSSProperties =
                meta.axis === 'x' ? { left: `${pct}%` } : { top: `${pct}%` }
              return (
                <Handle
                  key={extraHandleId(side, i)}
                  id={extraHandleId(side, i)}
                  type="source"
                  position={meta.position}
                  style={style}
                  className="diagen-rf-handle"
                />
              )
            })
          })
        : null}
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
