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

/** Máximo de puntos extra por lado (evita saturar un lado). */
export const MAX_EXTRA_PER_SIDE = 6

/** Margen en % a cada extremo del lado, para no pegar puntos a las esquinas. */
const MARGIN_PCT = 20

/**
 * Posiciones (en % a lo largo del lado, 0..100) de `count` puntos extra,
 * repartidos proporcionalmente entre los márgenes (space-between).
 *
 * count=1 → [50]; count=2 → [~36, ~64]; count=3 → [~30, 50, 70]; etc.
 * Cuando count es impar uno cae en el centro (50%), donde ya está el imán
 * central: funcionalmente es el mismo punto de conexión, así que conviven sin
 * problema (el imán central siempre existe aparte).
 */
export function extraHandlePositions(count: number): number[] {
  if (count <= 0) return []
  const span = 100 - 2 * MARGIN_PCT
  const positions: number[] = []
  for (let i = 0; i < count; i++) {
    positions.push(MARGIN_PCT + (span * (i + 1)) / (count + 1))
  }
  return positions
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
