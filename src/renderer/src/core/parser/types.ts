export type Direction = 'LR' | 'TB'
export type EdgeStyle = 'solid' | 'dashed'
export type EdgeDirection = 'forward' | 'back' | 'both'

export interface ArchNode {
  id: string
  type: string
  label: string
  clusterId?: string
}

export interface ArchEdge {
  id: string
  from: string
  to: string
  label?: string
  style: EdgeStyle
  direction: EdgeDirection
}

export interface ArchCluster {
  id: string
  label: string
  nodeIds: string[]
  childClusterIds: string[]
  parentClusterId?: string
}

export interface ArchGraph {
  name: string
  direction: Direction
  nodes: ArchNode[]
  edges: ArchEdge[]
  clusters: ArchCluster[]
}

export interface Point {
  x: number
  y: number
}

export interface LayoutNode {
  id: string
  type: string
  label: string
  x: number
  y: number
  width: number
  height: number
  clusterId?: string
}

export interface LayoutCluster {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  parentClusterId?: string
}

export interface LayoutEdge {
  id: string
  from: string
  to: string
  label?: string
  style: EdgeStyle
  direction: EdgeDirection
  points: Point[]
  labelPosition?: Point
}

export interface LayoutResult {
  name: string
  direction: Direction
  width: number
  height: number
  nodes: LayoutNode[]
  clusters: LayoutCluster[]
  edges: LayoutEdge[]
}
