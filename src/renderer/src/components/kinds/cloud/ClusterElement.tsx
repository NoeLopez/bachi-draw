import type { LayoutCluster } from '../../../core/parser/kinds/cloud/types'

interface ClusterElementProps {
  cluster: LayoutCluster
}

export default function ClusterElement({ cluster }: ClusterElementProps): React.JSX.Element {
  return (
    <g className="diagen-cluster" transform={`translate(${cluster.x}, ${cluster.y})`}>
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
      />
      <text className="diagen-cluster-label" x={14} y={20} dominantBaseline="middle">
        {cluster.label}
      </text>
    </g>
  )
}
