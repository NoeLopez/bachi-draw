// ──────────────────────────────────────────────────────────────────────────
// Puntos de conexión extra por lado.
//
// Cada nodo tiene siempre 4 imanes centrales (ids t/r/b/l). Desde el editor se
// pueden añadir puntos EXTRA por lado; aquí vive la única fuente de verdad de:
//   - cómo se distribuyen a lo largo del lado (proporcional, con margen), y
//   - cómo se nombran sus ids (estables, sin colisionar con t/r/b/l).
// Tanto ServiceNode (handles reales) como el modal de edición (preview) usan
// estas funciones, para que render y preview no diverjan.
// ──────────────────────────────────────────────────────────────────────────

export type Side = 'top' | 'right' | 'bottom' | 'left'

/** Prefijo de id por lado para los handles extra (e = "extra"). */
export const EXTRA_PREFIX: Record<Side, string> = {
  top: 'et',
  right: 'er',
  bottom: 'eb',
  left: 'el'
}

export const SIDES: Side[] = ['top', 'right', 'bottom', 'left']

/** Máximo de puntos extra por lado. 6 extra = 7 puntos totales; con punto de
 * 8px y margen 6% caben en un nodo de ~80px sin solaparse (gap ≈8.8px). */
export const MAX_EXTRA_PER_SIDE = 6

/** Margen en % a cada extremo del lado, para no pegar puntos a las esquinas.
 * Reducido para que quepan hasta 6 extra por lado separados. */
const MARGIN_PCT = 6

/**
 * Posiciones (en % a lo largo del lado, 0..100) de `count` puntos EXTRA,
 * repartidos respetando el imán central fijo en 50%.
 *
 * El centro divide el lado en dos mitades: izquierda [MARGIN, 50] y derecha
 * [50, 100-MARGIN]. Los extra se reparten simétricamente, llenando cada mitad
 * con un space-between propio, de modo que el conjunto (centro + extra) queda
 * equilibrado y el centro nunca se mueve.
 *
 *   0 → []                       (solo el central en 50%)
 *   1 → [72]                     (medio de la mitad derecha)
 *   2 → [28, 72]                 (uno por mitad, simétrico)
 *   4 → [21, 35, 65, 79]         (dos por mitad, simétrico)
 *
 * left = floor(count/2) van a la mitad izquierda; el resto a la derecha. Con
 * números impares la derecha lleva uno más (asimetría mínima aceptable).
 */
export function extraHandlePositions(count: number): number[] {
  if (count <= 0) return []
  const left = Math.floor(count / 2) // puntos en la mitad izquierda
  const right = count - left // resto en la derecha (>= left)

  // Reparte `n` puntos en [a, b] con space-between (huecos iguales en ambos
  // extremos): posición k (1-based) = a + (b-a) * k / (n+1).
  const spread = (a: number, b: number, n: number): number[] => {
    const out: number[] = []
    for (let k = 1; k <= n; k++) out.push(a + ((b - a) * k) / (n + 1))
    return out
  }

  const leftPositions = spread(MARGIN_PCT, 50, left)
  const rightPositions = spread(50, 100 - MARGIN_PCT, right)
  return [...leftPositions, ...rightPositions]
}

/** Id estable del extra `i` (0-based) de un lado. */
export function extraHandleId(side: Side, i: number): string {
  return `${EXTRA_PREFIX[side]}${i}`
}

/** Todos los ids extra que tendría un nodo con la config dada (para detectar
 * aristas huérfanas al reducir puntos). */
export function allExtraHandleIds(extra: Partial<Record<Side, number>> | undefined): Set<string> {
  const ids = new Set<string>()
  if (!extra) return ids
  for (const side of SIDES) {
    const n = extra[side] ?? 0
    for (let i = 0; i < n; i++) ids.add(extraHandleId(side, i))
  }
  return ids
}
