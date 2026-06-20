import type {
  CloudCluster,
  CloudGraph,
  CloudNode,
  Direction,
  LayoutResult
} from '../../../parser/kinds/cloud/types'

// ──────────────────────────────────────────────────────────────────────────
// Inverso de toReactFlow/layout: reconstruye el CloudGraph (modelo de dominio)
// a partir del LayoutResult editado.
//
// El LayoutResult es la fuente de verdad en memoria de las ediciones visuales
// (mover/renombrar/conectar/borrar pasan por updateLayoutWithReactFlow). Derivar
// el grafo de aquí — en vez de mantener un `model` paralelo en cada handler —
// garantiza que el .bachi guardado refleje EXACTAMENTE lo que se ve, sin tocar
// los handlers de edición ni arriesgar el zoom/fitView.
// ──────────────────────────────────────────────────────────────────────────

export function layoutToCloudGraph(layout: LayoutResult, name = ''): CloudGraph {
  // Ids de cluster realmente existentes: descarta referencias colgantes (p.ej.
  // un nodo cuyo grupo se borró) para que el DSL resultante siga siendo válido.
  const clusterIds = new Set(layout.clusters.map((c) => c.id))

  const nodes: CloudNode[] = layout.nodes.map((n) => {
    const clusterId = n.clusterId && clusterIds.has(n.clusterId) ? n.clusterId : undefined
    return {
      id: n.id,
      type: n.type,
      label: n.label,
      ...(clusterId ? { clusterId } : {})
    }
  })

  const clusters: CloudCluster[] = layout.clusters.map((c) => {
    const parentClusterId =
      c.parentClusterId && clusterIds.has(c.parentClusterId) ? c.parentClusterId : undefined
    return {
      id: c.id,
      label: c.label,
      nodeIds: [],
      childClusterIds: [],
      ...(parentClusterId ? { parentClusterId } : {})
    }
  })

  // Rellena la jerarquía (nodeIds / childClusterIds) a partir de las relaciones.
  const byId = new Map(clusters.map((c) => [c.id, c]))
  for (const n of nodes) {
    if (n.clusterId) byId.get(n.clusterId)?.nodeIds.push(n.id)
  }
  for (const c of clusters) {
    if (c.parentClusterId) byId.get(c.parentClusterId)?.childClusterIds.push(c.id)
  }

  const edges = layout.edges.map((e) => ({
    id: e.id,
    from: e.from,
    to: e.to,
    ...(e.label ? { label: e.label } : {}),
    style: e.style,
    direction: e.direction
  }))

  return {
    name,
    direction: (layout.direction ?? 'LR') as Direction,
    nodes,
    edges,
    clusters
  }
}
