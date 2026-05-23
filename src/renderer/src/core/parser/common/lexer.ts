/**
 * Lexer reusable para los DSLs de Bachi Draw.
 *
 * Produce un stream de tokens con posición (línea, columna, offset) para que
 * los parsers puedan emitir errores con contexto preciso. Es minimalista a
 * propósito: las palabras clave específicas de cada tipo de diagrama las
 * resuelve el parser, no el lexer (los keywords se entregan como `ident`).
 */

export type TokenKind =
  | 'ident' // [a-z_][a-z0-9_-]*  (también palabras clave del DSL)
  | 'string' // texto entre comillas
  | 'bracket-label' // contenido raw entre [ y ] (admite unicode arbitrario)
  | 'lparen' // (
  | 'rparen' // )
  | 'colon' // :
  | 'arrow-solid' // -->
  | 'arrow-dashed' // -.->
  | 'arrow-bidir' // <-->
  | 'newline'
  | 'eof'

export interface Token {
  kind: TokenKind
  value: string
  line: number // 1-indexed
  column: number // 1-indexed
  offset: number
}

export class LexError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number
  ) {
    super(message)
  }
}

const IDENT_HEAD = /[a-zA-Z_]/
const IDENT_BODY = /[a-zA-Z0-9_/.-]/

export function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  let line = 1
  let col = 1

  const peek = (offset = 0): string => source[i + offset] ?? ''

  const push = (kind: TokenKind, value: string, atLine: number, atCol: number): void => {
    tokens.push({ kind, value, line: atLine, column: atCol, offset: i - value.length })
  }

  while (i < source.length) {
    const c = peek()

    // Saltos de línea
    if (c === '\n') {
      push('newline', '\n', line, col)
      i++
      line++
      col = 1
      continue
    }
    // Espacios en blanco (sin newline)
    if (c === ' ' || c === '\t' || c === '\r') {
      i++
      col++
      continue
    }
    // Comentarios: # hasta fin de línea
    if (c === '#') {
      while (i < source.length && peek() !== '\n') {
        i++
        col++
      }
      continue
    }
    // Strings entre comillas dobles
    if (c === '"') {
      const startLine = line
      const startCol = col
      i++
      col++
      let value = ''
      while (i < source.length && peek() !== '"') {
        if (peek() === '\n') {
          throw new LexError('string sin cerrar (falta ")', startLine, startCol)
        }
        if (peek() === '\\' && peek(1) === '"') {
          value += '"'
          i += 2
          col += 2
        } else {
          value += peek()
          i++
          col++
        }
      }
      if (i >= source.length) {
        throw new LexError('string sin cerrar (falta ")', startLine, startCol)
      }
      i++ // consume cierre "
      col++
      tokens.push({
        kind: 'string',
        value,
        line: startLine,
        column: startCol,
        offset: i - value.length - 2
      })
      continue
    }
    // Brackets como label "raw": consume todo hasta `]` y emite un único token
    // con el contenido como string. Permite cualquier carácter (incluido unicode,
    // espacios, em-dash, etc.) sin tener que tokenizar palabra por palabra.
    if (c === '[') {
      const startLine = line
      const startCol = col
      i++
      col++
      let raw = ''
      while (i < source.length && peek() !== ']') {
        if (peek() === '\n') {
          throw new LexError('label sin cerrar (falta "]")', startLine, startCol)
        }
        raw += peek()
        i++
        col++
      }
      if (i >= source.length) {
        throw new LexError('label sin cerrar (falta "]")', startLine, startCol)
      }
      i++ // consume `]`
      col++
      tokens.push({
        kind: 'bracket-label',
        value: raw.trim(),
        line: startLine,
        column: startCol,
        offset: i - raw.length - 2
      })
      continue
    }
    if (c === '(') {
      push('lparen', '(', line, col)
      i++
      col++
      continue
    }
    if (c === ')') {
      push('rparen', ')', line, col)
      i++
      col++
      continue
    }
    if (c === ':') {
      push('colon', ':', line, col)
      i++
      col++
      continue
    }
    // Flechas: --> · -.-> · <-->
    if (c === '<') {
      if (peek(1) === '-' && peek(2) === '-' && peek(3) === '>') {
        push('arrow-bidir', '<-->', line, col)
        i += 4
        col += 4
        continue
      }
      throw new LexError(`carácter inesperado "<"`, line, col)
    }
    if (c === '-') {
      // -.->
      if (peek(1) === '.' && peek(2) === '-' && peek(3) === '>') {
        push('arrow-dashed', '-.->', line, col)
        i += 4
        col += 4
        continue
      }
      // -->
      if (peek(1) === '-' && peek(2) === '>') {
        push('arrow-solid', '-->', line, col)
        i += 3
        col += 3
        continue
      }
      throw new LexError(`secuencia inválida que inicia con "-"`, line, col)
    }
    // Identificadores (incluye snake_case, kebab-case, paths como aws/alb)
    if (IDENT_HEAD.test(c)) {
      const startLine = line
      const startCol = col
      let value = ''
      while (i < source.length && IDENT_BODY.test(peek())) {
        value += peek()
        i++
        col++
      }
      tokens.push({
        kind: 'ident',
        value,
        line: startLine,
        column: startCol,
        offset: i - value.length
      })
      continue
    }

    throw new LexError(`carácter inesperado "${c}"`, line, col)
  }

  tokens.push({ kind: 'eof', value: '', line, column: col, offset: i })
  return tokens
}
