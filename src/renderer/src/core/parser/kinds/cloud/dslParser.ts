/**
 * Parser del DSL `arch-cloud`.
 *
 * Gramática (informal):
 *
 *   document   := header line*
 *   header     := "arch-cloud" direction? NEWLINE
 *   direction  := "lr" | "tb"
 *   line       := group | service | edge | NEWLINE
 *
 *   group      := "group" IDENT category? label? membership? NEWLINE
 *   service    := "service" IDENT category? label? membership? NEWLINE
 *   category   := "(" IDENT ")"
 *   label      := "[" (IDENT | STRING)+ "]"
 *   membership := "in" IDENT
 *
 *   edge       := IDENT (arrow IDENT)+ edgeLabel? NEWLINE
 *   arrow      := "-->" | "-.->" | "<-->"
 *   edgeLabel  := ":" (IDENT | STRING)
 *
 *   Chains: `a --> b --> c` produce 2 edges (a→b, b→c) con la misma etiqueta
 *   final si se especifica.
 *
 * Comentarios: `# ...` hasta fin de línea (consumidos por el lexer).
 * Identificadores: snake_case o kebab-case. Tipos como `aws/alb` se permiten.
 */

import { LexError, Token, tokenize } from '../../common/lexer'
import type {
  CloudCluster,
  CloudGraph,
  CloudNode,
  Direction,
  EdgeDirection,
  EdgeStyle
} from './types'

export class CloudDslParseError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number,
    public source?: string
  ) {
    super(formatMessage(message, line, column, source))
  }
}

function formatMessage(
  message: string,
  line: number,
  column: number,
  source: string | undefined
): string {
  const prefix = `[línea ${line}, col ${column}] ${message}`
  if (!source) return prefix
  const lines = source.split('\n')
  const snippet = lines[line - 1] ?? ''
  const pointer = ' '.repeat(Math.max(0, column - 1)) + '^'
  return `${prefix}\n  ${snippet}\n  ${pointer}`
}

interface EdgeFragment {
  from: string
  to: string
  style: EdgeStyle
  direction: EdgeDirection
}

/** Desescapa un label leído del DSL: `\n` → salto de línea real, `\\` → `\`
 * (inverso de escapeLabel en serialize.ts). Permite labels multilínea en
 * `[...]` y en los `"..."` de las aristas. */
function unescapeLabel(text: string): string {
  return text.replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c))
}

class Parser {
  private pos = 0

  constructor(
    private readonly tokens: Token[],
    private readonly source: string
  ) {}

  parse(): CloudGraph {
    const graph: CloudGraph = {
      // El DSL no tiene campo de nombre. La app deriva el título del filename.
      name: '',
      direction: 'LR',
      nodes: [],
      edges: [],
      clusters: []
    }

    const knownIds = new Set<string>()
    let edgeCounter = 0

    this.parseHeader(graph)

    while (!this.eof()) {
      // Saltar líneas vacías
      if (this.peek().kind === 'newline') {
        this.consume()
        continue
      }
      const tok = this.peek()
      if (tok.kind !== 'ident') {
        throw this.error(
          `se esperaba "group", "service" o un identificador, se encontró "${tok.value}"`,
          tok
        )
      }

      if (tok.value === 'group') {
        const cluster = this.parseGroup()
        if (knownIds.has(cluster.id)) {
          throw this.error(`id duplicado: "${cluster.id}"`, tok)
        }
        knownIds.add(cluster.id)
        graph.clusters.push(cluster)
      } else if (tok.value === 'service') {
        const node = this.parseService()
        if (knownIds.has(node.id)) {
          throw this.error(`id duplicado: "${node.id}"`, tok)
        }
        knownIds.add(node.id)
        graph.nodes.push(node)
      } else {
        // Línea de edges: id arrow id (arrow id)* [: label]
        const edges = this.parseEdgeLine()
        for (const frag of edges) {
          if (!knownIds.has(frag.from)) {
            throw this.error(`id desconocido en edge: "${frag.from}"`, tok)
          }
          if (!knownIds.has(frag.to)) {
            throw this.error(`id desconocido en edge: "${frag.to}"`, tok)
          }
          graph.edges.push({
            id: `e_${edgeCounter++}_${frag.from}__${frag.to}`,
            from: frag.from,
            to: frag.to,
            label: frag.label,
            style: frag.style,
            direction: frag.direction
          })
        }
      }
    }

    // Resolver relación cluster ↔ nodo / cluster ↔ sub-cluster.
    this.resolveContainment(graph)
    return graph
  }

  // ─────────────── Header ───────────────

  private parseHeader(graph: CloudGraph): void {
    // Permite líneas en blanco antes del header.
    while (this.peek().kind === 'newline') this.consume()

    const head = this.peek()
    if (head.kind !== 'ident' || head.value !== 'arch-cloud') {
      throw this.error(`se esperaba "arch-cloud" como primera palabra`, head)
    }
    this.consume()

    // Direction opcional: lr | tb
    const next = this.peek()
    if (next.kind === 'ident' && (next.value === 'lr' || next.value === 'tb')) {
      graph.direction = next.value.toUpperCase() as Direction
      this.consume()
    }

    this.expect('newline', 'se esperaba salto de línea tras el header')
  }

  // ─────────────── Group / Service ───────────────

  private parseGroup(): CloudCluster {
    const keyword = this.consume() // 'group'
    const id = this.expectIdent('id del grupo')
    let category: string | undefined
    let label: string | undefined
    let parent: string | undefined

    if (this.peek().kind === 'lparen') {
      category = this.parseCategory()
    }
    if (this.peek().kind === 'bracket-label') {
      label = unescapeLabel(this.consume().value)
    }
    if (this.peek().kind === 'ident' && this.peek().value === 'in') {
      this.consume()
      parent = this.expectIdent('id del cluster padre')
    }
    this.expectNewlineOrEof('se esperaba fin de línea tras la declaración de group')

    void keyword

    return {
      id,
      label: label ?? id,
      nodeIds: [],
      childClusterIds: [],
      parentClusterId: parent,
      ...(category ? { type: category } : {})
    }
  }

  private parseService(): CloudNode {
    this.consume() // 'service'
    const id = this.expectIdent('id del servicio')
    let type = 'oss/server' // fallback si falta
    let label: string | undefined
    let parent: string | undefined

    if (this.peek().kind === 'lparen') {
      type = this.parseCategory()
    }
    if (this.peek().kind === 'bracket-label') {
      label = unescapeLabel(this.consume().value)
    }
    if (this.peek().kind === 'ident' && this.peek().value === 'in') {
      this.consume()
      parent = this.expectIdent('id del cluster padre')
    }
    this.expectNewlineOrEof('se esperaba fin de línea tras la declaración de service')

    return { id, type, label: label ?? id, clusterId: parent }
  }

  private parseCategory(): string {
    this.expect('lparen', 'se esperaba "("')
    const ident = this.expectIdent('categoría del paréntesis')
    this.expect('rparen', 'se esperaba ")"')
    return ident
  }

  // ─────────────── Edges ───────────────

  // Lee `a --> b --> c [: label]` o `a -.-> b` etc.
  private parseEdgeLine(): Array<EdgeFragment & { label?: string }> {
    const firstTok = this.peek()
    const first = this.expectIdent('origen de la conexión')
    const ids: string[] = [first]
    const arrows: Array<{ style: EdgeStyle; direction: EdgeDirection }> = []

    while (
      this.peek().kind === 'arrow-solid' ||
      this.peek().kind === 'arrow-dashed' ||
      this.peek().kind === 'arrow-bidir'
    ) {
      const arr = this.consume()
      const meta: { style: EdgeStyle; direction: EdgeDirection } = {
        style: arr.kind === 'arrow-dashed' ? 'dashed' : 'solid',
        direction: arr.kind === 'arrow-bidir' ? 'both' : 'forward'
      }
      arrows.push(meta)
      const next = this.expectIdent('destino de la conexión')
      ids.push(next)
    }

    if (arrows.length === 0) {
      throw this.error(`se esperaba una flecha (-->, -.->, <-->) después de "${first}"`, firstTok)
    }

    // Label opcional tras `:`
    let label: string | undefined
    if (this.peek().kind === 'colon') {
      this.consume()
      const tok = this.peek()
      if (tok.kind === 'string' || tok.kind === 'ident') {
        // Label puede ser una secuencia de palabras o un string entre comillas.
        // Caso simple: un solo ident/string.
        const parts: string[] = [tok.value]
        this.consume()
        while (this.peek().kind === 'ident' || this.peek().kind === 'string') {
          parts.push(this.peek().value)
          this.consume()
        }
        label = unescapeLabel(parts.join(' '))
      } else {
        throw this.error(`se esperaba el texto del label tras ":"`, tok)
      }
    }
    this.expectNewlineOrEof('se esperaba fin de línea tras la conexión')

    const fragments: Array<EdgeFragment & { label?: string }> = []
    for (let i = 0; i < arrows.length; i++) {
      const isLast = i === arrows.length - 1
      fragments.push({
        from: ids[i],
        to: ids[i + 1],
        style: arrows[i].style,
        direction: arrows[i].direction,
        // En un chain solo el último segmento recibe el label si está presente.
        label: isLast ? label : undefined
      })
    }
    return fragments
  }

  // ─────────────── Resolución de containment ───────────────

  private resolveContainment(graph: CloudGraph): void {
    const clustersById = new Map(graph.clusters.map((c) => [c.id, c]))

    for (const node of graph.nodes) {
      if (!node.clusterId) continue
      const parent = clustersById.get(node.clusterId)
      if (!parent) {
        throw new CloudDslParseError(
          `el servicio "${node.id}" referencia un grupo desconocido: "${node.clusterId}"`,
          1,
          1
        )
      }
      parent.nodeIds.push(node.id)
    }

    for (const cluster of graph.clusters) {
      if (!cluster.parentClusterId) continue
      const parent = clustersById.get(cluster.parentClusterId)
      if (!parent) {
        throw new CloudDslParseError(
          `el grupo "${cluster.id}" referencia un grupo padre desconocido: "${cluster.parentClusterId}"`,
          1,
          1
        )
      }
      parent.childClusterIds.push(cluster.id)
    }
  }

  // ─────────────── Utilidades del parser ───────────────

  private peek(offset = 0): Token {
    return this.tokens[this.pos + offset]
  }

  private consume(): Token {
    return this.tokens[this.pos++]
  }

  private eof(): boolean {
    return this.peek().kind === 'eof'
  }

  private expect(kind: Token['kind'], message: string): Token {
    const tok = this.peek()
    if (tok.kind !== kind) throw this.error(message, tok)
    return this.consume()
  }

  private expectIdent(what: string): string {
    const tok = this.peek()
    if (tok.kind !== 'ident') {
      throw this.error(`se esperaba ${what}`, tok)
    }
    return this.consume().value
  }

  private expectNewlineOrEof(message: string): void {
    const tok = this.peek()
    if (tok.kind === 'newline') {
      this.consume()
      return
    }
    if (tok.kind === 'eof') return
    throw this.error(message, tok)
  }

  private error(message: string, tok: Token): CloudDslParseError {
    return new CloudDslParseError(message, tok.line, tok.column, this.source)
  }
}

export function parseCloudDsl(source: string): CloudGraph {
  let tokens: Token[]
  try {
    tokens = tokenize(source)
  } catch (err) {
    if (err instanceof LexError) {
      throw new CloudDslParseError(err.message, err.line, err.column, source)
    }
    throw err
  }
  return new Parser(tokens, source).parse()
}
