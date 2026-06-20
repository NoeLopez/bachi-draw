import type {
  EdgeDirection,
  EdgeStyle,
  ExtraHandles,
  LayoutResult,
  LayoutNode,
  LayoutCluster,
  LayoutEdge,
  Point
} from '../../../parser/kinds/cloud/types'

// Forma mínima que reconcile LEE de la fuente: un `.bachid` de disco
// (ArchdDocument) o un LayoutResult en memoria. Todo opcional porque proviene de
// JSON no confiable; los campos se fusionan defensivamente sobre el layout de
// ELK. Tanto ArchdDocument como LayoutResult son asignables a este tipo.
interface ReconcileNode {
  id: string
  x?: number
  y?: number
  width?: number
  height?: number
  extraHandles?: ExtraHandles | null
}
interface ReconcileCluster {
  id: string
  x?: number
  y?: number
  width?: number
  height?: number
}
interface ReconcileEdge {
  id: string
  from: string
  to: string
  label?: string | null
  style?: EdgeStyle
  direction?: EdgeDirection
  points?: Point[]
  sourceHandle?: string | null
  targetHandle?: string | null
  jumps?: boolean
}
export interface ReconcileSource {
  nodes?: ReconcileNode[]
  clusters?: ReconcileCluster[]
  edges?: ReconcileEdge[]
}

/**
 * Reconciles the newly computed ELK layout with positions/edges from a saved `.bachid` file
 * or the current in-memory layout state.
 *
 * It preserves manual modifications:
 * 1. Overwrites node coordinates/dimensions if they exist in the reconciliation source.
 * 2. Overwrites cluster coordinates/dimensions if they exist in the reconciliation source.
 * 3. Restores edge definitions (bend points, direction, labels) and preserves custom
 *    user-drawn edges that aren't in the DSL.
 */
export function reconcileLayoutWithArchd(
  elkLayout: LayoutResult,
  archd: ReconcileSource | null | undefined
): LayoutResult {
  if (!archd) return elkLayout

  // Create maps for fast lookup
  const archdNodes = new Map(archd.nodes?.map((n) => [n.id, n]) ?? [])
  const archdClusters = new Map(archd.clusters?.map((c) => [c.id, c]) ?? [])
  const archdEdges = new Map(archd.edges?.map((e) => [e.id, e]) ?? [])

  // 1. Reconcile nodes
  const nodes = elkLayout.nodes.map((n): LayoutNode => {
    const saved = archdNodes.get(n.id)
    if (saved) {
      return {
        ...n,
        x: typeof saved.x === 'number' ? saved.x : n.x,
        y: typeof saved.y === 'number' ? saved.y : n.y,
        width: typeof saved.width === 'number' ? saved.width : n.width,
        height: typeof saved.height === 'number' ? saved.height : n.height,
        extraHandles: saved.extraHandles ?? n.extraHandles
      }
    }
    return n
  })

  // 2. Reconcile clusters
  const clusters = elkLayout.clusters.map((c): LayoutCluster => {
    const saved = archdClusters.get(c.id)
    if (saved) {
      return {
        ...c,
        x: typeof saved.x === 'number' ? saved.x : c.x,
        y: typeof saved.y === 'number' ? saved.y : c.y,
        width: typeof saved.width === 'number' ? saved.width : c.width,
        height: typeof saved.height === 'number' ? saved.height : c.height
      }
    }
    return c
  })

  // 3. Reconcile edges
  const edges = elkLayout.edges.map((e): LayoutEdge => {
    const saved = archdEdges.get(e.id)
    if (saved) {
      return {
        ...e,
        from: saved.from || e.from,
        to: saved.to || e.to,
        label: saved.label ?? e.label,
        style: saved.style || e.style,
        direction: saved.direction || e.direction,
        points: saved.points || e.points,
        sourceHandle: saved.sourceHandle ?? e.sourceHandle,
        targetHandle: saved.targetHandle ?? e.targetHandle,
        jumps: saved.jumps ?? e.jumps
      }
    }
    return e
  })

  // 4. Capture any user-created connections that exist in the saved state but not in the DSL
  const dslEdgeIds = new Set(elkLayout.edges.map((e) => e.id))
  const extraEdges: LayoutEdge[] = []
  if (archd.edges) {
    for (const saved of archd.edges) {
      if (!dslEdgeIds.has(saved.id)) {
        extraEdges.push({
          id: saved.id,
          from: saved.from,
          to: saved.to,
          label: saved.label ?? undefined,
          style: saved.style || 'solid',
          direction: saved.direction || 'forward',
          points: saved.points || [],
          sourceHandle: saved.sourceHandle ?? null,
          targetHandle: saved.targetHandle ?? null,
          jumps: saved.jumps ?? false
        })
      }
    }
  }

  const allEdges = [...edges, ...extraEdges]

  // 5. Recompute the absolute layout width and height
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const n of nodes) {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + n.width)
    maxY = Math.max(maxY, n.y + n.height)
  }
  for (const c of clusters) {
    minX = Math.min(minX, c.x)
    minY = Math.min(minY, c.y)
    maxX = Math.max(maxX, c.x + c.width)
    maxY = Math.max(maxY, c.y + c.height)
  }

  const width = minX === Infinity ? 0 : maxX - minX + 40
  const height = minY === Infinity ? 0 : maxY - minY + 40

  return {
    ...elkLayout,
    width,
    height,
    nodes,
    clusters,
    edges: allEdges
  }
}
