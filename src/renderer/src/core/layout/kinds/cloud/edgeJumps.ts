// ──────────────────────────────────────────────────────────────────────────
// "Line hops" / saltos de aristas.
//
// Cuando dos aristas ortogonales se cruzan, dibujamos un arquito en una de
// ellas para dar a entender que "salta" por encima de la otra y que es una
// línea continua distinta.
//
// Trabajamos solo con segmentos horizontales y verticales (aristas tipo `step`,
// borderRadius 0), donde un cruce es simplemente la intersección de un segmento
// H con uno V. Eso hace la detección exacta y barata.
//
// Convención de quién salta: salta el segmento HORIZONTAL sobre el VERTICAL.
// Es una elección arbitraria pero consistente, así nunca saltan los dos.
// ──────────────────────────────────────────────────────────────────────────

export interface Pt {
  x: number
  y: number
}

/** Radio del arco del salto, en px de lienzo. */
export const JUMP_RADIUS = 5

/** Radio del redondeo de las esquinas donde la flecha dobla. */
export const CORNER_RADIUS = 6

/**
 * Parsea el path de `getSmoothStepPath` en una lista de vértices ortogonales.
 *
 * Ojo: con borderRadius 0 esa función NO emite solo M/L; sus esquinas usan
 * `Q ctrlx,ctrly endx,endy` con tamaño de bend 0, así que el control coincide
 * con el vértice. Tomamos el último par (x,y) de cada comando (el vértice real)
 * y luego eliminamos puntos colineales/duplicados para quedarnos con la
 * polilínea ortogonal limpia. Devuelve null si no logra ≥2 puntos.
 */
export function parseOrthogonalPath(d: string): Pt[] | null {
  const raw: Pt[] = []
  const re = /([MLQCAST])([-\d.,\s]*)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(d))) {
    const nums = m[2]
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)
    if (nums.length < 2) continue
    // El vértice es siempre el último par de coordenadas del comando.
    raw.push({ x: nums[nums.length - 2], y: nums[nums.length - 1] })
  }
  // Limpia duplicados consecutivos y colapsa puntos colineales.
  const pts: Pt[] = []
  for (const p of raw) {
    const last = pts[pts.length - 1]
    if (last && last.x === p.x && last.y === p.y) continue
    if (pts.length >= 2) {
      const a = pts[pts.length - 2]
      const b = last
      const colinearH = a.y === b.y && b.y === p.y
      const colinearV = a.x === b.x && b.x === p.x
      if (colinearH || colinearV) {
        pts[pts.length - 1] = p // extiende el segmento en vez de crear vértice
        continue
      }
    }
    pts.push(p)
  }
  return pts.length >= 2 ? pts : null
}

export interface Seg {
  a: Pt
  b: Pt
  horizontal: boolean
}

function toSegments(pts: Pt[]): Seg[] {
  const segs: Seg[] = []
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    if (a.x === b.x && a.y === b.y) continue
    segs.push({ a, b, horizontal: a.y === b.y })
  }
  return segs
}

/** Intersección de un segmento horizontal con uno vertical, o null. */
function crossPoint(h: Seg, v: Seg): Pt | null {
  const y = h.a.y
  const x = v.a.x
  const hMinX = Math.min(h.a.x, h.b.x)
  const hMaxX = Math.max(h.a.x, h.b.x)
  const vMinY = Math.min(v.a.y, v.b.y)
  const vMaxY = Math.max(v.a.y, v.b.y)
  // El cruce debe caer estrictamente dentro de ambos segmentos (con margen para
  // no poner arcos justo en las esquinas / conexiones).
  const margin = JUMP_RADIUS + 1
  if (x <= hMinX + margin || x >= hMaxX - margin) return null
  if (y <= vMinY + margin || y >= vMaxY - margin) return null
  return { x, y }
}

/**
 * Para una arista dada (sus puntos) y los segmentos del resto de aristas,
 * reconstruye su path SVG insertando un arco en CADA punto donde la arista
 * cruza a otra. Salta tanto en sus tramos horizontales (cruzando verticales
 * ajenos) como en los verticales (cruzando horizontales ajenos), así la flecha
 * activada salta todo lo que toca.
 *
 * @param ownPts     Puntos del path de la arista que estamos dibujando.
 * @param otherSegs  Segmentos (H y V) de todas las demás aristas.
 */
export function buildPathWithJumps(ownPts: Pt[], otherSegs: Seg[]): string {
  const segs = toSegments(ownPts)
  let d = `M ${ownPts[0].x},${ownPts[0].y}`

  segs.forEach((seg, i) => {
    const isFirst = i === 0
    const isLast = i === segs.length - 1
    // Recorte por esquina: si hay un segmento antes/después, dejamos hueco de
    // CORNER_RADIUS para el arco de la esquina. El recorte se limita a la mitad
    // del tramo para no invertirlo en segmentos cortos.
    const len = seg.horizontal ? Math.abs(seg.b.x - seg.a.x) : Math.abs(seg.b.y - seg.a.y)
    const r = Math.min(CORNER_RADIUS, len / 2)
    const trimStart = isFirst ? 0 : r
    const trimEnd = isLast ? 0 : r

    if (seg.horizontal) {
      const goingRight = seg.b.x > seg.a.x
      const dir = goingRight ? 1 : -1
      const startX = seg.a.x + trimStart * dir
      const endX = seg.b.x - trimEnd * dir
      const y = seg.a.y

      // Saltos: cruces con horizontales ajenos dentro del tramo recortado.
      const crosses: number[] = []
      for (const v of otherSegs) {
        if (v.horizontal) continue
        const p = crossPoint(seg, v)
        if (p && (goingRight ? p.x > startX && p.x < endX : p.x < startX && p.x > endX)) {
          crosses.push(p.x)
        }
      }
      crosses.sort((a, b) => (goingRight ? a - b : b - a))
      for (const cx of crosses) {
        d += ` L ${cx - JUMP_RADIUS * dir},${y}`
        d += ` A ${JUMP_RADIUS},${JUMP_RADIUS} 0 0 ${goingRight ? 1 : 0} ${cx + JUMP_RADIUS * dir},${y}`
      }
      d += ` L ${endX},${y}`
    } else {
      const goingDown = seg.b.y > seg.a.y
      const dir = goingDown ? 1 : -1
      const startY = seg.a.y + trimStart * dir
      const endY = seg.b.y - trimEnd * dir
      const x = seg.a.x

      const crosses: number[] = []
      for (const h of otherSegs) {
        if (!h.horizontal) continue
        const p = crossPoint(h, seg)
        if (p && (goingDown ? p.y > startY && p.y < endY : p.y < startY && p.y > endY)) {
          crosses.push(p.y)
        }
      }
      crosses.sort((a, b) => (goingDown ? a - b : b - a))
      for (const cy of crosses) {
        d += ` L ${x},${cy - JUMP_RADIUS * dir}`
        d += ` A ${JUMP_RADIUS},${JUMP_RADIUS} 0 0 ${goingDown ? 0 : 1} ${x},${cy + JUMP_RADIUS * dir}`
      }
      d += ` L ${x},${endY}`
    }

    // Arco de esquina hacia el siguiente segmento (si lo hay).
    if (!isLast) {
      const next = segs[i + 1]
      // El vértice compartido es seg.b (= next.a). El arco va del punto recortado
      // del segmento actual al punto recortado del siguiente.
      const corner = seg.b
      const nextLen = next.horizontal
        ? Math.abs(next.b.x - next.a.x)
        : Math.abs(next.b.y - next.a.y)
      const nr = Math.min(CORNER_RADIUS, nextLen / 2, r)
      let nx: number
      let ny: number
      if (next.horizontal) {
        nx = corner.x + (next.b.x > next.a.x ? nr : -nr)
        ny = corner.y
      } else {
        nx = corner.x
        ny = corner.y + (next.b.y > next.a.y ? nr : -nr)
      }
      // sweep-flag según el sentido del giro (producto cruzado entre entrada y
      // salida). Q (curva cuadrática con el vértice como control) da la esquina.
      d += ` Q ${corner.x},${corner.y} ${nx},${ny}`
    }
  })

  return d
}

/** Descompone una lista de puntos de path en segmentos H/V. */
export function segmentsOf(pts: Pt[]): Seg[] {
  return toSegments(pts)
}
