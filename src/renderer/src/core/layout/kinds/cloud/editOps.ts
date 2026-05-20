import type { LayoutResult } from '../../../parser/kinds/cloud/types'
import type { SelectedItem } from '../../../diagram/editor/store'
import { adjustEndpointOrthogonal } from './geometry'

/**
 * Mueve los elementos seleccionados por (dx, dy) y devuelve un nuevo
 * LayoutResult inmutable. Función pura: no muta el layout de entrada.
 *
 * Reglas:
 *   - Nodos seleccionados: se trasladan directamente.
 *   - Clusters seleccionados: arrastran a todos sus descendientes (nodos y
 *     sub-clusters recursivamente).
 *   - Aristas internas (ambos extremos movidos): se trasladan completas.
 *   - Aristas cruzando (un extremo movido): se reconecta ese endpoint
 *     manteniendo la ortogonalidad del último segmento.
 *   - Edges seleccionados directamente no se mueven (no tiene semántica
 *     mover una arista suelta en este modelo).
 */
export function moveElements(
  layout: LayoutResult,
  selection: SelectedItem[],
  dx: number,
  dy: number
): LayoutResult {
  if (dx === 0 && dy === 0) return layout

  // Mapas de containment a partir del layout.
  const childNodes = new Map<string, string[]>()
  const childClusters = new Map<string, string[]>()
  for (const n of layout.nodes) {
    if (!n.clusterId) continue
    const arr = childNodes.get(n.clusterId) ?? []
    arr.push(n.id)
    childNodes.set(n.clusterId, arr)
  }
  for (const c of layout.clusters) {
    if (!c.parentClusterId) continue
    const arr = childClusters.get(c.parentClusterId) ?? []
    arr.push(c.id)
    childClusters.set(c.parentClusterId, arr)
  }

  const movedNodeIds = new Set<string>()
  const movedClusterIds = new Set<string>()

  const collectDescendants = (clusterId: string): void => {
    movedClusterIds.add(clusterId)
    for (const nid of childNodes.get(clusterId) ?? []) movedNodeIds.add(nid)
    for (const cid of childClusters.get(clusterId) ?? []) collectDescendants(cid)
  }

  for (const item of selection) {
    if (item.kind === 'node') movedNodeIds.add(item.id)
    else if (item.kind === 'cluster') collectDescendants(item.id)
  }

  if (movedNodeIds.size === 0 && movedClusterIds.size === 0) return layout

  const nodes = layout.nodes.map((n) =>
    movedNodeIds.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n
  )
  const clusters = layout.clusters.map((c) =>
    movedClusterIds.has(c.id) ? { ...c, x: c.x + dx, y: c.y + dy } : c
  )

  const edges = layout.edges.map((e) => {
    const fromIn = movedNodeIds.has(e.from)
    const toIn = movedNodeIds.has(e.to)
    if (!fromIn && !toIn) return e

    const points = e.points.map((p) => ({ ...p }))

    if (fromIn && toIn) {
      for (const p of points) {
        p.x += dx
        p.y += dy
      }
      const labelPosition = e.labelPosition
        ? { x: e.labelPosition.x + dx, y: e.labelPosition.y + dy }
        : undefined
      return { ...e, points, labelPosition }
    }

    // Arista cruzando: reconectar solo el endpoint del lado movido.
    if (fromIn) adjustEndpointOrthogonal(points, 'first', dx, dy)
    else adjustEndpointOrthogonal(points, 'last', dx, dy)
    return { ...e, points }
  })

  return { ...layout, nodes, clusters, edges }
}

/** Recalcula el bounding box que abarca todo el contenido del layout.
 * Útil tras mover elementos para que fit-to-container vuelva a encuadrar bien. */
export function recomputeBounds(layout: LayoutResult): { width: number; height: number } {
  let maxX = 0
  let maxY = 0
  for (const n of layout.nodes) {
    maxX = Math.max(maxX, n.x + n.width)
    maxY = Math.max(maxY, n.y + n.height + 20) // +20 por el label bajo el icono
  }
  for (const c of layout.clusters) {
    maxX = Math.max(maxX, c.x + c.width)
    maxY = Math.max(maxY, c.y + c.height)
  }
  for (const e of layout.edges) {
    for (const p of e.points) {
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    }
  }
  return { width: maxX, height: maxY }
}
