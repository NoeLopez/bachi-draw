import type { Point } from '../../../parser/kinds/cloud/types'

/**
 * Reconecta un extremo de un path tras mover el nodo al que se conecta,
 * preservando la ortogonalidad del segmento final. Si el delta tiene una
 * componente perpendicular al segmento original, inserta un bend point que
 * mantiene los dos sub-segmentos resultantes horizontales/verticales puros.
 *
 * Ejemplo: path [(50,100), (90,100), (100,100)] termina horizontal en (100,100).
 * Si el nodo se mueve a (105, 130) → delta (5, 30):
 *   - sólo mover endpoint daría [(50,100), (90,100), (105,130)] → último
 *     segmento diagonal (raro en routing ortogonal).
 *   - este ajuste produce [(50,100), (90,100), (105,100), (105,130)] →
 *     horizontal hasta (105,100) y luego vertical hasta (105,130).
 *
 * Muta el array `points` in-place.
 */
export function adjustEndpointOrthogonal(
  points: Point[],
  side: 'first' | 'last',
  dx: number,
  dy: number
): void {
  if (points.length < 2) return

  const endIdx = side === 'first' ? 0 : points.length - 1
  const neighborIdx = side === 'first' ? 1 : points.length - 2

  const endpoint = points[endIdx]
  const neighbor = points[neighborIdx]

  // Detectamos la dirección del segmento ANTES de mover el endpoint.
  const wasHorizontal = Math.abs(endpoint.y - neighbor.y) < 0.5
  const wasVertical = Math.abs(endpoint.x - neighbor.x) < 0.5

  endpoint.x += dx
  endpoint.y += dy

  // Si el delta perpendicular al segmento es significativo, insertamos un
  // bend para conservar ortogonalidad pura.
  if (wasHorizontal && Math.abs(dy) >= 0.5) {
    const bend = { x: endpoint.x, y: neighbor.y }
    const insertAt = side === 'first' ? 1 : points.length - 1
    points.splice(insertAt, 0, bend)
  } else if (wasVertical && Math.abs(dx) >= 0.5) {
    const bend = { x: neighbor.x, y: endpoint.y }
    const insertAt = side === 'first' ? 1 : points.length - 1
    points.splice(insertAt, 0, bend)
  }
}
