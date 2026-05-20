import type { LayoutNode, LayoutResult, Point } from '../../../parser/kinds/cloud/types'
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

/**
 * Elimina los elementos seleccionados. Función pura.
 *
 * Reglas:
 *   - Nodo: se borra junto con todas las aristas que lo tocan.
 *   - Edge: se borra la arista.
 *   - Cluster: se borra el contenedor pero NO sus hijos; los nodos y
 *     sub-clusters que contenía suben al padre del cluster borrado (o a root).
 *     Es la opción menos destructiva — no se pierden nodos por accidente.
 */
export function deleteElements(layout: LayoutResult, selection: SelectedItem[]): LayoutResult {
  const delNodes = new Set<string>()
  const delClusters = new Set<string>()
  const delEdges = new Set<string>()
  for (const item of selection) {
    if (item.kind === 'node') delNodes.add(item.id)
    else if (item.kind === 'cluster') delClusters.add(item.id)
    else if (item.kind === 'edge') delEdges.add(item.id)
  }
  if (delNodes.size === 0 && delClusters.size === 0 && delEdges.size === 0) return layout

  const parentOf = new Map<string, string | undefined>()
  for (const c of layout.clusters) parentOf.set(c.id, c.parentClusterId)

  // Sube por la cadena de ancestros saltando los clusters que también se borran.
  const resolveNewParent = (clusterId: string | undefined): string | undefined => {
    let p = clusterId
    while (p && delClusters.has(p)) p = parentOf.get(p)
    return p
  }

  const nodes = layout.nodes
    .filter((n) => !delNodes.has(n.id))
    .map((n) =>
      n.clusterId && delClusters.has(n.clusterId)
        ? { ...n, clusterId: resolveNewParent(n.clusterId) }
        : n
    )

  const clusters = layout.clusters
    .filter((c) => !delClusters.has(c.id))
    .map((c) =>
      c.parentClusterId && delClusters.has(c.parentClusterId)
        ? { ...c, parentClusterId: resolveNewParent(c.parentClusterId) }
        : c
    )

  const edges = layout.edges.filter(
    (e) => !delEdges.has(e.id) && !delNodes.has(e.from) && !delNodes.has(e.to)
  )

  return { ...layout, nodes, clusters, edges }
}

/** Centro del rectángulo del icono de un nodo. */
function nodeCenter(n: LayoutNode): Point {
  return { x: n.x + n.width / 2, y: n.y + n.height / 2 }
}

/** Punto en el borde del rect del nodo en dirección hacia (towardX, towardY). */
function borderPoint(n: LayoutNode, towardX: number, towardY: number): Point {
  const cx = n.x + n.width / 2
  const cy = n.y + n.height / 2
  const dx = towardX - cx
  const dy = towardY - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const hw = n.width / 2
  const hh = n.height / 2
  const scaleX = dx !== 0 ? hw / Math.abs(dx) : Infinity
  const scaleY = dy !== 0 ? hh / Math.abs(dy) : Infinity
  const scale = Math.min(scaleX, scaleY)
  return { x: cx + dx * scale, y: cy + dy * scale }
}

/**
 * Crea una arista entre dos nodos. Función pura. Los puntos se calculan
 * borde-a-borde (línea recta) sin re-ejecutar ELK; un "auto-layout" posterior
 * la rerutea ortogonalmente. Evita duplicar una arista from→to existente.
 */
export function addEdge(layout: LayoutResult, fromId: string, toId: string): LayoutResult {
  if (fromId === toId) return layout
  const from = layout.nodes.find((n) => n.id === fromId)
  const to = layout.nodes.find((n) => n.id === toId)
  if (!from || !to) return layout
  if (layout.edges.some((e) => e.from === fromId && e.to === toId)) return layout

  const ca = nodeCenter(from)
  const cb = nodeCenter(to)
  const points: Point[] = [borderPoint(from, cb.x, cb.y), borderPoint(to, ca.x, ca.y)]

  return {
    ...layout,
    edges: [
      ...layout.edges,
      {
        id: `e_user_${fromId}__${toId}_${Date.now()}`,
        from: fromId,
        to: toId,
        style: 'solid',
        direction: 'forward',
        points
      }
    ]
  }
}

/** Cambia el label de un nodo o cluster. Función pura. */
export function renameElement(
  layout: LayoutResult,
  kind: 'node' | 'cluster',
  id: string,
  label: string
): LayoutResult {
  if (kind === 'node') {
    return {
      ...layout,
      nodes: layout.nodes.map((n) => (n.id === id ? { ...n, label } : n))
    }
  }
  return {
    ...layout,
    clusters: layout.clusters.map((c) => (c.id === id ? { ...c, label } : c))
  }
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
