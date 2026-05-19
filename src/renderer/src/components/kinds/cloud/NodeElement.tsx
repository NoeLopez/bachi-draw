import type { LayoutNode } from '../../../core/parser/kinds/cloud/types'
import { getIconDataUri } from '../../../icons/registry'

interface NodeElementProps {
  node: LayoutNode
}

const ICON_SIZE = 56

export default function NodeElement({ node }: NodeElementProps): React.JSX.Element {
  const iconHref = getIconDataUri(node.type)
  const iconX = (node.width - ICON_SIZE) / 2
  const labelY = 2 + ICON_SIZE + 6 // justo debajo del icono, no del bounding box

  return (
    <g className="diagen-node" transform={`translate(${node.x}, ${node.y})`}>
      <image href={iconHref} x={iconX} y={2} width={ICON_SIZE} height={ICON_SIZE} />
      <text
        className="diagen-node-label"
        x={node.width / 2}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="hanging"
      >
        {node.label}
      </text>
    </g>
  )
}
