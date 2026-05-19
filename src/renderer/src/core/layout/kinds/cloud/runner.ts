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

export { ROOT_ID }
