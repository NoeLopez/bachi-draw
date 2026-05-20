import ELK from 'elkjs/lib/elk.bundled.js'
import type { ElkEdgeSection, ElkExtendedEdge, ElkNode } from 'elkjs'
import type {
  CloudEdge,
  CloudGraph,
  LayoutCluster,
  LayoutEdge,
  LayoutNode,
  LayoutResult,
  Point
} from '../../../parser/kinds/cloud/types'
import { NODE_SIZE, ROOT_ID, toElkGraph } from './transformer'
import { adjustEndpointOrthogonal } from './geometry'

const elk = new ELK()

function walkNodes(
  node: ElkNode,
  parentX: number,
  parentY: number,
  parentClusterId: string | undefined,
  isCluster: boolean,
  archNodeIds: Set<string>,
  archClusterIds: Set<string>,
  outNodes: LayoutNode[],
  outClusters: LayoutCluster[],
  archNodeLookup: Map<string, { type: string; label: string; clusterId?: string }>,
  archClusterLookup: Map<string, { label: string; parentClusterId?: string }>
): void {
  const absX = parentX + (node.x ?? 0)
  const absY = parentY + (node.y ?? 0)

  if (archClusterIds.has(node.id)) {
    const meta = archClusterLookup.get(node.id)
    outClusters.push({
      id: node.id,
      label: meta?.label ?? node.id,
      x: absX,
      y: absY,
      width: node.width ?? 0,
      height: node.height ?? 0,
      parentClusterId: meta?.parentClusterId
    })
  } else if (archNodeIds.has(node.id)) {
    const meta = archNodeLookup.get(node.id)
    outNodes.push({
      id: node.id,
      type: meta?.type ?? 'oss/server',
      label: meta?.label ?? node.id,
      x: absX,
      y: absY,
      width: NODE_SIZE.width,
      height: NODE_SIZE.height,
      clusterId: meta?.clusterId
    })
  }

  if (node.children) {
    for (const child of node.children) {
      walkNodes(
        child,
        absX,
        absY,
        isCluster ? node.id : parentClusterId,
        archClusterIds.has(child.id),
        archNodeIds,
        archClusterIds,
        outNodes,
        outClusters,
        archNodeLookup,
        archClusterLookup
      )
    }
  }
}

interface EdgeContext {
  parentX: number
  parentY: number
}

function collectEdges(
  node: ElkNode,
  ctx: EdgeContext,
  archEdgesById: Map<string, CloudEdge>,
  out: LayoutEdge[]
): void {
  const absX = ctx.parentX + (node.x ?? 0)
  const absY = ctx.parentY + (node.y ?? 0)

  if (node.edges) {
    for (const edge of node.edges) {
      const archEdge = archEdgesById.get(edge.id)
      if (!archEdge) continue
      const points = pointsFromEdge(edge, absX, absY)
      const layoutEdge: LayoutEdge = {
        id: edge.id,
        from: archEdge.from,
        to: archEdge.to,
        label: archEdge.label,
        style: archEdge.style,
        direction: archEdge.direction,
        points
      }
      const labelMid = labelMidpoint(edge, absX, absY, points)
      if (labelMid) layoutEdge.labelPosition = labelMid
      out.push(layoutEdge)
    }
  }

  if (node.children) {
    for (const child of node.children) {
      collectEdges(child, { parentX: absX, parentY: absY }, archEdgesById, out)
    }
  }
}

function pointsFromEdge(edge: ElkExtendedEdge, offsetX: number, offsetY: number): Point[] {
  const sections: ElkEdgeSection[] = edge.sections ?? []
  if (sections.length === 0) return []
  const collected: Point[] = []
  for (const section of sections) {
    collected.push({ x: section.startPoint.x + offsetX, y: section.startPoint.y + offsetY })
    if (section.bendPoints) {
      for (const bp of section.bendPoints) {
        collected.push({ x: bp.x + offsetX, y: bp.y + offsetY })
      }
    }
    collected.push({ x: section.endPoint.x + offsetX, y: section.endPoint.y + offsetY })
  }
  return collected
}

function labelMidpoint(
  edge: ElkExtendedEdge,
  offsetX: number,
  offsetY: number,
  points: Point[]
): Point | undefined {
  const label = edge.labels?.[0]
  if (label && typeof label.x === 'number' && typeof label.y === 'number') {
    const w = label.width ?? 0
    const h = label.height ?? 0
    return {
      x: label.x + offsetX + w / 2,
      y: label.y + offsetY + h / 2
    }
  }
  if (points.length < 2) return undefined
  const mid = Math.floor(points.length / 2)
  const a = points[mid - 1]
  const b = points[mid]
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export async function runLayout(graph: CloudGraph): Promise<LayoutResult> {
  const elkGraph = toElkGraph(graph)
  const result = await elk.layout(elkGraph)

  const archNodeIds = new Set(graph.nodes.map((n) => n.id))
  const archClusterIds = new Set(graph.clusters.map((c) => c.id))
  const archNodeLookup = new Map(
    graph.nodes.map((n) => [n.id, { type: n.type, label: n.label, clusterId: n.clusterId }])
  )
  const archClusterLookup = new Map(
    graph.clusters.map((c) => [c.id, { label: c.label, parentClusterId: c.parentClusterId }])
  )
  const archEdgesById = new Map(graph.edges.map((e) => [e.id, e]))

  const nodes: LayoutNode[] = []
  const clusters: LayoutCluster[] = []
  if (result.children) {
    for (const child of result.children) {
      walkNodes(
        child,
        0,
        0,
        undefined,
        archClusterIds.has(child.id),
        archNodeIds,
        archClusterIds,
        nodes,
        clusters,
        archNodeLookup,
        archClusterLookup
      )
    }
  }

  const edges: LayoutEdge[] = []
  collectEdges(result as ElkNode, { parentX: 0, parentY: 0 }, archEdgesById, edges)

  // Post-procesado: centrar el contenido dentro de clusters cuando ELK los
  // dimensionó más grandes que sus hijos por el ancho del label.
  centerClusterContents(nodes, clusters, edges, graph)

  return {
    name: graph.name,
    direction: graph.direction,
    width: result.width ?? 0,
    height: result.height ?? 0,
    nodes,
    clusters,
    edges
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Compactado y centrado de hijos dentro de clusters
// ─────────────────────────────────────────────────────────────────────────

// Espacio que el cluster reserva para su label/padding. Debe coincidir con
// los valores definidos en clusterLayoutOptions() del transformer.
const CLUSTER_PADDING = { top: 44, left: 12, bottom: 14, right: 12 }
// Umbral para considerar que vale la pena reposicionar (evita micro-ajustes).
const CENTER_THRESHOLD = 4
// Umbral mínimo para encoger un cluster: solo lo hacemos si sobra bastante
// espacio, para evitar tocar layouts ya razonablemente apretados.
const SHRINK_THRESHOLD = 16
// Estimado del ancho del label (debe coincidir con el del transformer).
const LABEL_CHAR_WIDTH = 7
const LABEL_HEIGHT = 18

function centerClusterContents(
  nodes: LayoutNode[],
  clusters: LayoutCluster[],
  edges: LayoutEdge[],
  graph: CloudGraph
): void {
  // Mapas auxiliares para navegar la jerarquía.
  const childNodesByCluster = new Map<string, LayoutNode[]>()
  const childClustersByCluster = new Map<string, LayoutCluster[]>()
  for (const n of nodes) {
    if (!n.clusterId) continue
    const arr = childNodesByCluster.get(n.clusterId) ?? []
    arr.push(n)
    childNodesByCluster.set(n.clusterId, arr)
  }
  for (const c of clusters) {
    if (!c.parentClusterId) continue
    const arr = childClustersByCluster.get(c.parentClusterId) ?? []
    arr.push(c)
    childClustersByCluster.set(c.parentClusterId, arr)
  }

  // Construir mapa cluster → todos los nodos descendientes (transitivo).
  // Sirve para detectar qué aristas son internas al cluster.
  const descendantNodes = new Map<string, Set<string>>()
  const computeDescendants = (clusterId: string): Set<string> => {
    const cached = descendantNodes.get(clusterId)
    if (cached) return cached
    const out = new Set<string>()
    for (const n of childNodesByCluster.get(clusterId) ?? []) out.add(n.id)
    for (const c of childClustersByCluster.get(clusterId) ?? []) {
      for (const id of computeDescendants(c.id)) out.add(id)
    }
    descendantNodes.set(clusterId, out)
    return out
  }
  for (const c of clusters) computeDescendants(c.id)

  // Profundidad del cluster (root = 0) para procesar de hojas hacia arriba.
  // Aunque solo movemos hijos directos (no resize), procesar leaf-first evita
  // que mover un sub-cluster afecte el bbox de su padre antes de centrarlo.
  const depth = new Map<string, number>()
  const computeDepth = (clusterId: string): number => {
    const cached = depth.get(clusterId)
    if (cached !== undefined) return cached
    const cluster = clusters.find((c) => c.id === clusterId)
    if (!cluster || !cluster.parentClusterId) {
      depth.set(clusterId, 0)
      return 0
    }
    const d = computeDepth(cluster.parentClusterId) + 1
    depth.set(clusterId, d)
    return d
  }
  for (const c of clusters) computeDepth(c.id)

  const sorted = [...clusters].sort((a, b) => (depth.get(b.id) ?? 0) - (depth.get(a.id) ?? 0))

  for (const cluster of sorted) {
    const directNodes = childNodesByCluster.get(cluster.id) ?? []
    const directClusters = childClustersByCluster.get(cluster.id) ?? []
    if (directNodes.length === 0 && directClusters.length === 0) continue

    // Bounding box absoluto de los hijos directos.
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of directNodes) {
      if (n.x < minX) minX = n.x
      if (n.y < minY) minY = n.y
      if (n.x + n.width > maxX) maxX = n.x + n.width
      if (n.y + n.height > maxY) maxY = n.y + n.height
    }
    for (const c of directClusters) {
      if (c.x < minX) minX = c.x
      if (c.y < minY) minY = c.y
      if (c.x + c.width > maxX) maxX = c.x + c.width
      if (c.y + c.height > maxY) maxY = c.y + c.height
    }
    const bboxW = maxX - minX
    const bboxH = maxY - minY

    // Tamaño mínimo real del cluster: lo que demande el label o el contenido,
    // lo que sea mayor, más el padding fijo.
    const labelMinW = Math.max(80, Math.ceil(cluster.label.length * LABEL_CHAR_WIDTH))
    const idealW = Math.max(labelMinW, bboxW) + CLUSTER_PADDING.left + CLUSTER_PADDING.right
    const idealH = CLUSTER_PADDING.top + Math.max(bboxH, LABEL_HEIGHT) + CLUSTER_PADDING.bottom

    // ELK suele dar al cluster más espacio del necesario porque reserva canales
    // para las aristas externas. Si sobra > SHRINK_THRESHOLD, encogemos.
    if (cluster.width - idealW > SHRINK_THRESHOLD) cluster.width = idealW
    if (cluster.height - idealH > SHRINK_THRESHOLD) cluster.height = idealH

    // Recomputar área interna con el cluster ya ajustado.
    const innerLeft = cluster.x + CLUSTER_PADDING.left
    const innerRight = cluster.x + cluster.width - CLUSTER_PADDING.right
    const innerTop = cluster.y + CLUSTER_PADDING.top
    const innerBottom = cluster.y + cluster.height - CLUSTER_PADDING.bottom
    const innerW = innerRight - innerLeft
    const innerH = innerBottom - innerTop

    // Centro objetivo del bbox de hijos dentro del área interna.
    const targetX = innerLeft + (innerW - bboxW) / 2
    const targetY = innerTop + (innerH - bboxH) / 2
    const dx = targetX - minX
    const dy = targetY - minY

    if (Math.abs(dx) < CENTER_THRESHOLD && Math.abs(dy) < CENTER_THRESHOLD) continue

    // Mover todos los descendientes (nodos y sub-clusters) por el mismo delta.
    const inside = computeDescendants(cluster.id)
    const movedClusterIds = new Set<string>()
    movedClusterIds.add(cluster.id) // el cluster mismo no se mueve, pero lo marco como visitado
    for (const n of nodes) {
      if (!inside.has(n.id)) continue
      n.x += dx
      n.y += dy
    }
    // Mover también sub-clusters descendientes (todos los clusters cuyo
    // descendantNodes esté contenido en inside).
    for (const c of clusters) {
      if (c.id === cluster.id) continue
      const cDesc = descendantNodes.get(c.id)
      if (!cDesc || cDesc.size === 0) continue
      let allInside = true
      for (const id of cDesc) {
        if (!inside.has(id)) {
          allInside = false
          break
        }
      }
      if (allInside) {
        c.x += dx
        c.y += dy
        movedClusterIds.add(c.id)
      }
    }

    // Mover aristas:
    //  · ambos extremos dentro del cluster → mover todos los puntos
    //  · solo un extremo dentro → reconectar el endpoint manteniendo
    //    la ortogonalidad del último segmento (puede requerir insertar
    //    un bend point intermedio si el delta no es axial-alineado)
    for (const edge of edges) {
      const fromIn = inside.has(edge.from)
      const toIn = inside.has(edge.to)
      if (fromIn && toIn) {
        for (const p of edge.points) {
          p.x += dx
          p.y += dy
        }
        if (edge.labelPosition) {
          edge.labelPosition.x += dx
          edge.labelPosition.y += dy
        }
      } else if (fromIn) {
        adjustEndpointOrthogonal(edge.points, 'first', dx, dy)
      } else if (toIn) {
        adjustEndpointOrthogonal(edge.points, 'last', dx, dy)
      }
    }
  }

  void graph // se mantiene en la firma por si se necesita info adicional
}

export { ROOT_ID }
