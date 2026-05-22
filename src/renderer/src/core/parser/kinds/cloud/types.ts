// Modelo de dominio para el tipo de diagrama `arch-cloud`.
// Cada tipo de diagrama (cloud, bpmn, sequence, etc.) declara su propio
// CloudGraph-equivalente; el pipeline de layout y render trabaja con tipos
// específicos del kind correspondiente.

export type Direction = 'LR' | 'TB'
export type EdgeStyle = 'solid' | 'dashed'
export type EdgeDirection = 'forward' | 'back' | 'both'

export interface CloudNode {
  id: string
  type: string
  label: string
  clusterId?: string
}

export interface CloudEdge {
  id: string
  from: string
  to: string
  label?: string
  style: EdgeStyle
  direction: EdgeDirection
}

export interface CloudCluster {
  id: string
  label: string
  nodeIds: string[]
  childClusterIds: string[]
  parentClusterId?: string
}

export interface CloudGraph {
  name: string
  direction: Direction
  nodes: CloudNode[]
  edges: CloudEdge[]
  clusters: CloudCluster[]
}

export interface Point {
  x: number
  y: number
}

/** Nº de puntos de conexión EXTRA por lado, añadidos a mano desde el editor.
 * Se suman a los 4 imanes centrales (t/r/b/l) que todo nodo tiene siempre. */
export interface ExtraHandles {
  top?: number
  right?: number
  bottom?: number
  left?: number
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
  extraHandles?: ExtraHandles
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
  /** Handle (punto de conexión) por el que la arista sale del nodo origen
   * y entra al destino, ej. 'r', 'l1'. Si falta, React Flow elige el más
   * cercano. Solo lo fijan las aristas creadas/editadas en el editor. */
  sourceHandle?: string | null
  targetHandle?: string | null
  /** true = la arista dibuja saltos sobre las que cruza (activado a mano). */
  jumps?: boolean
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
