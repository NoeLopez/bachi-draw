// Sugerencias de autocompletado para el editor del DSL arch-cloud.
//
// Es una función pura: dado el texto, la posición del caret y el contexto
// (ids conocidos + tipos de icono disponibles), decide qué ofrecer. La UI
// (dropdown, navegación con teclado) vive en BachiCodeEditor.
//
// Reglas (estilo IntelliJ):
//  - NO sugiere con palabra vacía: solo aparece al escribir la primera letra
//    (nunca justo tras un Enter en una línea en blanco).
//  - Primer token de la línea → keywords (declaración) + ids (origen de edge).
//  - Dentro de `(...)`          → tipos de icono.
//  - Tras `in`                  → ids (grupo padre).
//  - En una línea de edge       → ids (destinos).
//  - Posición del id que se declara (tras `service`/`group`) → nada.

export type SuggestKind = 'keyword' | 'type' | 'id' | 'mixed'

export interface SuggestResult {
  items: string[]
  /** Índice en `text` donde empieza la palabra parcial a reemplazar. */
  replaceStart: number
  /** Índice donde termina (= caret). */
  replaceEnd: number
  kind: SuggestKind
}

// Palabras clave que abren una declaración (primer token de la línea).
const SYNTAX_KEYWORDS = ['service', 'group']

/** True si el valor es una palabra clave de sintaxis (para añadir espacio tras
 * autocompletar). */
export function isSyntaxKeyword(value: string): boolean {
  return SYNTAX_KEYWORDS.includes(value)
}

const MAX_ITEMS = 8
// Caracteres válidos en la palabra parcial (ids, tipos como aws/ec2, keywords).
const WORD_RE = /[a-zA-Z0-9_/.-]*$/

function rankAndCap(candidates: string[], partial: string): string[] {
  const q = partial.toLowerCase()
  const seen = new Set<string>()
  const unique = candidates.filter((c) => (seen.has(c) ? false : seen.add(c)))
  const matches = unique.filter((c) => c.toLowerCase().includes(q))
  // Prefijo primero, luego el resto; alfabético dentro de cada grupo.
  matches.sort((a, b) => {
    const ap = a.toLowerCase().startsWith(q) ? 0 : 1
    const bp = b.toLowerCase().startsWith(q) ? 0 : 1
    if (ap !== bp) return ap - bp
    return a.localeCompare(b)
  })
  return matches.slice(0, MAX_ITEMS)
}

export function computeSuggestions(
  text: string,
  caret: number,
  knownIds: string[],
  iconTypes: string[]
): SuggestResult | null {
  const lineStart = text.lastIndexOf('\n', caret - 1) + 1
  const lineUpToCaret = text.slice(lineStart, caret)

  // Palabra parcial inmediatamente antes del caret.
  const partial = lineUpToCaret.match(WORD_RE)?.[0] ?? ''
  // Sin nada escrito todavía (línea vacía tras Enter, o tras un espacio): no
  // molestamos. Las sugerencias solo arrancan al escribir la primera letra.
  if (partial.length < 1) return null
  const replaceStart = caret - partial.length

  // ¿Dentro de paréntesis sin cerrar en esta línea? → tipo de icono.
  const opens = (lineUpToCaret.match(/\(/g) ?? []).length
  const closes = (lineUpToCaret.match(/\)/g) ?? []).length
  if (opens > closes) {
    return finish(iconTypes, partial, replaceStart, caret, 'type')
  }

  // Texto de la línea antes de la palabra parcial.
  const prefix = text.slice(lineStart, replaceStart).trim()

  if (prefix === '') {
    // Primer token: keyword (declaración) o id (origen de una conexión).
    return finish([...SYNTAX_KEYWORDS, ...knownIds], partial, replaceStart, caret, 'mixed')
  }

  const words = prefix.split(/\s+/)
  const firstWord = words[0]
  const lastWord = words[words.length - 1]

  if (lastWord === 'in') {
    // Grupo padre.
    return finish(knownIds, partial, replaceStart, caret, 'id')
  }
  if (firstWord === 'service' || firstWord === 'group') {
    // Estamos nombrando el id NUEVO (o el label): no tiene sentido sugerir.
    return null
  }
  // Línea de conexión: orígenes/destinos son ids existentes.
  return finish(knownIds, partial, replaceStart, caret, 'id')
}

function finish(
  candidates: string[],
  partial: string,
  replaceStart: number,
  replaceEnd: number,
  kind: SuggestKind
): SuggestResult | null {
  const items = rankAndCap(candidates, partial)
  if (items.length === 0) return null
  // Si la única coincidencia es exactamente lo ya escrito, no molestamos.
  if (items.length === 1 && items[0] === partial) return null
  return { items, replaceStart, replaceEnd, kind }
}
