import type { CloudFlowNode } from './toReactFlow'

// ──────────────────────────────────────────────────────────────────────────
// Snapping de alineación ("imán") al arrastrar nodos.
//
// Mientras se arrastra un nodo, comparamos el centro del nodo movido con el
// centro de los demás. Si la distancia en X o Y cae dentro de SNAP_THRESHOLD,
// forzamos esa coordenada para que coincida exactamente: el nodo se "pega" a la
// línea recta. Para despegarlo hay que mover más allá del umbral, lo que da la
// sensación de imán.
//
// React Flow maneja posiciones RELATIVAS al padre para nodos anidados en
// clusters. Para comparar centros entre nodos de distintos contenedores
// trabajamos siempre en coordenadas ABSOLUTAS y, al final, devolvemos la
// posición corregida de vuelta en el sistema relativo del nodo arrastrado.
// ──────────────────────────────────────────────────────────────────────────

/** Distancia (en px de lienzo) dentro de la cual el imán engancha. */
export const SNAP_THRESHOLD = 8

export interface GuideLine {
  /** 'x' = línea vertical (alinea coordenada X); 'y' = línea horizontal. */
  orientation: 'x' | 'y'
  /** Posición absoluta de la línea en el eje correspondiente. */
  position: number
}

export interface SnapResult {
  /** Posición corregida del nodo arrastrado, en coordenadas RELATIVAS al padre. */
  position: { x: number; y: number }
  /** Guías a dibujar (vacío si no hubo enganche). */
  guides: GuideLine[]
}

interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** Posición absoluta del nodo, resolviendo la cadena de padres. */
function absolutePosition(
  node: CloudFlowNode,
  byId: Map<string, CloudFlowNode>
): { x: number; y: number } {
  let x = node.position.x
  let y = node.position.y
  let parentId = node.parentId
  while (parentId) {
    const parent = byId.get(parentId)
    if (!parent) break
    x += parent.position.x
    y += parent.position.y
    parentId = parent.parentId
  }
  return { x, y }
}

function boxOf(node: CloudFlowNode, byId: Map<string, CloudFlowNode>): Box {
  const abs = absolutePosition(node, byId)
  return {
    x: abs.x,
    y: abs.y,
    width: node.width ?? node.measured?.width ?? 0,
    height: node.height ?? node.measured?.height ?? 0
  }
}

/**
 * Calcula la posición corregida y las guías para un nodo que se está
 * arrastrando, alineando su centro con el centro de los demás nodos.
 *
 * @param dragged   El nodo que se mueve, con su posición ya actualizada por RF.
 * @param allNodes  Todos los nodos actuales del lienzo.
 */
export function snapToAlignment(dragged: CloudFlowNode, allNodes: CloudFlowNode[]): SnapResult {
  const byId = new Map(allNodes.map((n) => [n.id, n]))

  const draggedBox = boxOf(dragged, byId)
  const draggedCenterX = draggedBox.x + draggedBox.width / 2
  const draggedCenterY = draggedBox.y + draggedBox.height / 2

  // Buscamos el mejor candidato (menor distancia) para cada eje.
  let bestX: { dist: number; center: number } | null = null
  let bestY: { dist: number; center: number } | null = null

  for (const other of allNodes) {
    if (other.id === dragged.id) continue
    // No alinear con un ancestro del nodo arrastrado: moverías el centro hacia
    // el del contenedor, lo que no es lo que el usuario espera.
    if (other.id === dragged.parentId) continue

    const box = boxOf(other, byId)
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2

    const dx = Math.abs(cx - draggedCenterX)
    if (dx <= SNAP_THRESHOLD && (!bestX || dx < bestX.dist)) {
      bestX = { dist: dx, center: cx }
    }
    const dy = Math.abs(cy - draggedCenterY)
    if (dy <= SNAP_THRESHOLD && (!bestY || dy < bestY.dist)) {
      bestY = { dist: dy, center: cy }
    }
  }

  // Diferencia entre posición absoluta del nodo y su posición relativa: el
  // offset del padre. Lo usamos para volver a coordenadas relativas.
  const parentOffsetX = draggedBox.x - dragged.position.x
  const parentOffsetY = draggedBox.y - dragged.position.y

  const guides: GuideLine[] = []
  let newAbsX = draggedBox.x
  let newAbsY = draggedBox.y

  if (bestX) {
    // Alinear el centro X del nodo con el centro del candidato.
    newAbsX = bestX.center - draggedBox.width / 2
    guides.push({ orientation: 'x', position: bestX.center })
  }
  if (bestY) {
    newAbsY = bestY.center - draggedBox.height / 2
    guides.push({ orientation: 'y', position: bestY.center })
  }

  return {
    position: {
      x: newAbsX - parentOffsetX,
      y: newAbsY - parentOffsetY
    },
    guides
  }
}
