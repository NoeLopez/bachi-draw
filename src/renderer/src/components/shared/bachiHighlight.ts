// Tokenizador ligero del DSL arch-cloud para resaltado de sintaxis en el editor.
//
// A diferencia del lexer real (core/parser/common/lexer.ts), este es TOLERANTE:
// nunca lanza y preserva TODOS los caracteres (espacios, saltos de línea, texto
// suelto). Eso es imprescindible porque (1) se ejecuta en cada pulsación sobre
// código potencialmente incompleto/inválido y (2) la capa de resaltado debe
// quedar carácter-a-carácter alineada con el <textarea> que tiene encima.

export type BachiTokenType =
  | 'comment'
  | 'keyword'
  | 'arrow'
  | 'type'
  | 'label'
  | 'string'
  | 'colon'
  | 'punct'
  | 'ident'
  | 'plain'

export interface BachiToken {
  value: string
  type: BachiTokenType
}

// Palabras clave del DSL. `arch-cloud` es un único ident (el guión es válido en
// el cuerpo de identificador). `lr`/`tb` son direcciones; `in` es pertenencia.
const KEYWORDS = new Set(['arch-cloud', 'group', 'service', 'in', 'lr', 'tb'])

const IDENT_HEAD = /[a-zA-Z_]/
const IDENT_BODY = /[a-zA-Z0-9_/.-]/
// Caracteres que pueden iniciar un token significativo (cortan un run "plain").
const SIGNIFICANT = /[#"[\]():<-]|[a-zA-Z_]/

export function tokenizeBachi(source: string): BachiToken[] {
  const tokens: BachiToken[] = []
  let i = 0
  const n = source.length
  // Profundidad de paréntesis: dentro de `(...)` los idents son el tipo de icono.
  let parenDepth = 0

  const push = (value: string, type: BachiTokenType): void => {
    if (value) tokens.push({ value, type })
  }

  while (i < n) {
    const c = source[i]

    // Comentario: # hasta fin de línea (sin incluir el salto).
    if (c === '#') {
      let j = i
      while (j < n && source[j] !== '\n') j++
      push(source.slice(i, j), 'comment')
      i = j
      continue
    }

    // String entre comillas dobles (tolera el cierre ausente).
    if (c === '"') {
      let j = i + 1
      while (j < n && source[j] !== '"' && source[j] !== '\n') j++
      if (j < n && source[j] === '"') j++
      push(source.slice(i, j), 'string')
      i = j
      continue
    }

    // Label entre corchetes (tolera el cierre ausente).
    if (c === '[') {
      let j = i + 1
      while (j < n && source[j] !== ']' && source[j] !== '\n') j++
      if (j < n && source[j] === ']') j++
      push(source.slice(i, j), 'label')
      i = j
      continue
    }

    // Flechas: <-->  ·  -.->  ·  -->
    if (c === '<' && source.startsWith('<-->', i)) {
      push('<-->', 'arrow')
      i += 4
      continue
    }
    if (c === '-' && source.startsWith('-.->', i)) {
      push('-.->', 'arrow')
      i += 4
      continue
    }
    if (c === '-' && source.startsWith('-->', i)) {
      push('-->', 'arrow')
      i += 3
      continue
    }

    if (c === '(') {
      parenDepth++
      push('(', 'punct')
      i++
      continue
    }
    if (c === ')') {
      if (parenDepth > 0) parenDepth--
      push(')', 'punct')
      i++
      continue
    }
    if (c === ':') {
      push(':', 'colon')
      i++
      continue
    }

    // Identificadores (incluye paths como aws/ec2, kebab y snake case).
    if (IDENT_HEAD.test(c)) {
      let j = i + 1
      while (j < n && IDENT_BODY.test(source[j])) j++
      const word = source.slice(i, j)
      if (parenDepth > 0) push(word, 'type')
      else push(word, KEYWORDS.has(word) ? 'keyword' : 'ident')
      i = j
      continue
    }

    // Resto (espacios, saltos de línea, caracteres sueltos): se acumula en un
    // único token "plain" hasta el próximo carácter significativo.
    let j = i + 1
    while (j < n && !SIGNIFICANT.test(source[j])) j++
    push(source.slice(i, j), 'plain')
    i = j
  }

  return tokens
}
