import { Handle, NodeResizer, type NodeProps, Position } from '@xyflow/react'
import type { ShapeNode as ShapeNodeType } from '../../../core/layout/kinds/cloud/toReactFlow'
import type { ShapeType } from '../../../core/layout/kinds/cloud/shapes'
import NodeLabelInput from './NodeLabelInput'

const HANDLES = [
  { id: 't', position: Position.Top },
  { id: 'r', position: Position.Right },
  { id: 'b', position: Position.Bottom },
  { id: 'l', position: Position.Left }
] as const

function ShapeSvg({
  type,
  w,
  h,
  fill,
  stroke,
  strokeWidth
}: {
  type: ShapeType
  w: number
  h: number
  fill: string
  stroke: string
  strokeWidth: number
}): React.JSX.Element {
  const sw = strokeWidth
  const m = sw / 2

  switch (type) {
    case 'rectangle':
      return (
        <rect
          x={m}
          y={m}
          width={w - sw}
          height={h - sw}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
      )
    case 'rounded-rect':
      return (
        <rect
          x={m}
          y={m}
          width={w - sw}
          height={h - sw}
          rx={14}
          ry={14}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
      )
    case 'circle':
      return (
        <ellipse
          cx={w / 2}
          cy={h / 2}
          rx={w / 2 - m}
          ry={h / 2 - m}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
      )
    case 'diamond': {
      const pts = `${w / 2},${m} ${w - m},${h / 2} ${w / 2},${h - m} ${m},${h / 2}`
      return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} />
    }
    case 'arrow': {
      const tip = w - m
      const neck = w * 0.68
      const top1 = h * 0.28 + m
      const top2 = m
      const bot1 = h - h * 0.28 - m
      const bot2 = h - m
      const mid = h / 2
      const pts = `${m},${top1} ${neck},${top1} ${neck},${top2} ${tip},${mid} ${neck},${bot2} ${neck},${bot1} ${m},${bot1}`
      return (
        <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      )
    }
    case 'textbox':
      return (
        <rect
          x={m}
          y={m}
          width={w - sw}
          height={h - sw}
          fill="transparent"
          stroke={stroke}
          strokeWidth={sw}
          strokeDasharray="5 4"
        />
      )
  }
}

export default function ShapeNode({
  id,
  data,
  selected,
  width,
  height
}: NodeProps<ShapeNodeType>): React.JSX.Element {
  const w = width ?? 160
  const h = height ?? 80
  const { fillColor, strokeColor, strokeWidth, shapeType } = data

  return (
    <div
      className={`bachi-draw-rf-shape ${selected ? 'is-selected' : ''}`}
      style={{ width: w, height: h }}
    >
      <NodeResizer
        minWidth={40}
        minHeight={40}
        isVisible={selected}
        lineClassName="bachi-draw-rf-shape-resize-line"
        handleClassName="bachi-draw-rf-shape-resize-handle"
      />

      {HANDLES.map((h) => (
        <Handle
          key={h.id}
          id={h.id}
          type="source"
          position={h.position}
          className="bachi-draw-rf-handle"
        />
      ))}

      <svg width={w} height={h} className="bachi-draw-rf-shape-svg" aria-hidden="true">
        <ShapeSvg
          type={shapeType}
          w={w}
          h={h}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      </svg>

      {data.editing ? (
        <div className="bachi-draw-rf-shape-label-wrap">
          <NodeLabelInput nodeId={id} initial={data.label} align="center" />
        </div>
      ) : data.label ? (
        <div className="bachi-draw-rf-shape-label">{data.label}</div>
      ) : null}
    </div>
  )
}
