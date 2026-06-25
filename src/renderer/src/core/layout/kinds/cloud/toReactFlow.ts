import { type Edge, MarkerType, type Node } from '@xyflow/react'
import type { ExtraHandles, LayoutResult } from '../../../parser/kinds/cloud/types'
import { type ShapeType, SHAPE_PREFIX } from './shapes'

// ── Tipos de data de los nodos custom ───────────────────────────────────────

export interface ServiceNodeData extends Record<string, unknown> {
  label: string
  /** Tipo de icono (ej. aws/ec2). */
  iconType: string
  /** true mientras se edita el label inline. */
  editing?: boolean
  /** Puntos de conexión extra por lado (además de los 4 imanes centrales). */
  extraHandles?: ExtraHandles
}

export interface GroupNodeData extends Record<string, unknown> {
  label: string
  /** true mientras se edita el label inline. */
  editing?: boolean
  /** Tipo de grupo (ej. 'aws/groups/region'); deriva icono/color/borde. */
  groupType?: string
}

export interface ShapeNodeData extends Record<string, unknown> {
  label: string
  shapeType: ShapeType
  fillColor: string
  strokeColor: string
  strokeWidth: number
  /** true mientras se edita el label inline. */
  editing?: boolean
}

export interface CloudEdgeData extends Record<string, unknown> {
  style: 'solid' | 'dashed'
  direction: 'forward' | 'back' | 'both'
  /** true = dibuja arquitos donde cruza otras aristas (activado a mano). */
  jumps?: boolean
}

export type ServiceNode = Node<ServiceNodeData, 'service'>
export type GroupNode = Node<GroupNodeData, 'group'>
export type ShapeNode = Node<ShapeNodeData, 'shape'>
export type CloudFlowNode = ServiceNode | GroupNode | ShapeNode

/**
 * Apariencia de una arista (markers y dasharray) derivada de su estilo y
 * dirección. Fuente única para toReactFlow (al construir) y JumpEdge (al
 * renderizar), de modo que cambiar style/direction en vivo se refleje.
 */
export function edgeVisuals(
  style: 'solid' | 'dashed',
  direction: 'forward' | 'back' | 'both'
): {
  markerEnd: { type: MarkerType; width: number; height: number } | undefined
  markerStart: { type: MarkerType; width: number; height: number } | undefined
  strokeDasharray: string | undefined
} {
  const arrow = { type: MarkerType.ArrowClosed, width: 18, height: 18 }
  return {
    markerEnd: direction === 'back' ? undefined : arrow,
    markerStart: direction === 'back' || direction === 'both' ? arrow : undefined,
    strokeDasharray: style === 'dashed' ? '6 4' : undefined
  }
}

/**
 * z-index de cada grupo por ÁREA: el más pequeño queda ENCIMA del más grande
 * (estándar Lucid/draw.io). Así un grupo grande solapado nunca tapa el borde ni
 * la cabecera de uno más pequeño, que sigue siendo seleccionable. Todos los
 * grupos quedan por debajo de los services/shapes (z>=1): ordenamos por área
 * descendente y asignamos z negativos crecientes (i - N), de modo que a menor
 * área corresponde un z mayor (más cercano a 0) pero siempre < 1.
 */
export function groupZIndexByArea(
  groups: { id: string; width: number; height: number }[]
): Map<string, number> {
  const byAreaDesc = [...groups].sort((a, b) => b.width * b.height - a.width * a.height)
  return new Map(byAreaDesc.map((g, i) => [g.id, i - byAreaDesc.length]))
}

/**
 * Convierte el LayoutResult (coordenadas absolutas calculadas por ELK) al
 * modelo de React Flow.
 *
 * Diferencias clave que resuelve:
 *   - React Flow usa posiciones RELATIVAS al nodo padre para anidación; ELK
 *     da absolutas. Restamos la posición absoluta del cluster contenedor.
 *   - El orden importa: un nodo hijo debe aparecer en el array después de su
 *     padre. Emitimos primero los clusters ordenados por profundidad
 *     (ancestros antes que descendientes), luego los services.
 *   - El routing de aristas lo hace React Flow (smoothstep ortogonal); no
 *     reusamos los bend points de ELK.
 */
export function toReactFlow(layout: LayoutResult): {
  nodes: CloudFlowNode[]
  edges: Edge<CloudEdgeData>[]
} {
  const clusterById = new Map(layout.clusters.map((c) => [c.id, c]))

  const depthOf = (clusterId: string): number => {
    let d = 0
    let c = clusterById.get(clusterId)
    while (c?.parentClusterId) {
      d++
      c = clusterById.get(c.parentClusterId)
    }
    return d
  }

  // Posición absoluta del contenedor padre (0,0 si es top-level).
  const parentAbs = (clusterId: string | undefined): { x: number; y: number } => {
    if (!clusterId) return { x: 0, y: 0 }
    const c = clusterById.get(clusterId)
    return c ? { x: c.x, y: c.y } : { x: 0, y: 0 }
  }

  const nodes: CloudFlowNode[] = []

  const groupZ = groupZIndexByArea(
    layout.clusters.map((c) => ({ id: c.id, width: c.width, height: c.height }))
  )

  // Clusters primero, ordenados por profundidad (ancestros antes).
  const sortedClusters = [...layout.clusters].sort((a, b) => depthOf(a.id) - depthOf(b.id))
  for (const c of sortedClusters) {
    const base = parentAbs(c.parentClusterId)
    nodes.push({
      id: c.id,
      type: 'group',
      position: { x: c.x - base.x, y: c.y - base.y },
      data: { label: c.label, ...(c.type ? { groupType: c.type } : {}) },
      width: c.width,
      height: c.height,
      ...(c.parentClusterId ? { parentId: c.parentClusterId } : {}),
      // Detrás de los services (que se arrastran por su borde); entre grupos, el
      // más pequeño encima (ver groupZ arriba).
      zIndex: groupZ.get(c.id) ?? -1
    })
  }

  // Service y shape nodes.
  for (const n of layout.nodes) {
    const base = parentAbs(n.clusterId)
    const pos = { x: n.x - base.x, y: n.y - base.y }
    const common = {
      id: n.id,
      position: pos,
      width: n.width,
      height: n.height,
      ...(n.clusterId ? { parentId: n.clusterId } : {}),
      zIndex: 1
    }
    if (n.type.startsWith(SHAPE_PREFIX)) {
      nodes.push({
        ...common,
        type: 'shape',
        data: {
          label: n.label,
          shapeType: n.type.slice(SHAPE_PREFIX.length) as ShapeType,
          fillColor: n.fillColor ?? '#ffffff',
          strokeColor: n.strokeColor ?? '#334155',
          strokeWidth: n.strokeWidth ?? 2
        }
      } as ShapeNode)
    } else {
      nodes.push({
        ...common,
        type: 'service',
        data: { label: n.label, iconType: n.type, extraHandles: n.extraHandles }
      } as ServiceNode)
    }
  }

  // Edges. Tipo 'jump' = ortogonal con saltos sobre las aristas que cruza.
  const edges: Edge<CloudEdgeData>[] = layout.edges.map((e) => {
    const { markerEnd, markerStart, strokeDasharray } = edgeVisuals(e.style, e.direction)
    return {
      id: e.id,
      source: e.from,
      target: e.to,
      // Si se guardó un handle concreto, lo respetamos; si no, React Flow elige
      // el más cercano (sourceHandle/targetHandle undefined).
      ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
      ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
      type: 'jump',
      label: e.label,
      data: { style: e.style, direction: e.direction, jumps: e.jumps === true },
      markerEnd,
      markerStart,
      // Permite arrastrar cualquiera de los dos extremos para reconectar.
      reconnectable: true,
      style: strokeDasharray ? { strokeDasharray } : undefined
    }
  })

  return { nodes, edges }
}
