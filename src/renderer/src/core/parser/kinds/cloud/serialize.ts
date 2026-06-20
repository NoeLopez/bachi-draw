import type { CloudCluster, CloudEdge, CloudGraph, CloudNode } from './types'

// ──────────────────────────────────────────────────────────────────────────
// Serializador CloudGraph → DSL `arch-cloud`
//
// Reconstruye texto del DSL a partir del modelo. Útil para persistir el .bachi
// tras editar el diagrama visualmente. No preserva los comentarios ni el orden
// original del archivo (regenera limpio); sí respeta la jerarquía de clusters.
// ──────────────────────────────────────────────────────────────────────────

const HEADER_COMMENT = [
  '# arch-cloud v1 · header: "arch-cloud [lr|tb]" · group <id>[<label>] [in <parent>] ·',
  '# service <id>(<type>)[<label>] [in <parent>] · edges: a-->b · a -.->b (dashed) ·',
  '# a<-->b (bidir) · chains: a-->b-->c · label: ": texto" · # comentarios'
]

/** Escapa un label para meterlo en el DSL: los saltos de línea (edición
 * multilínea) se vuelven `\n` literal y las barras invertidas se duplican, para
 * no romper la sintaxis dentro de `[...]` o `"..."`. El parser lo desescapa. */
function escapeLabel(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n')
}

/** ¿El label de edge necesita comillas? Cualquier cosa que no sea un
 * identificador "pelado" (sin espacios ni escapes) se entrecomilla. */
function needsQuotes(text: string): boolean {
  return !/^[a-zA-Z0-9_/.-]+$/.test(text)
}

function serviceLine(n: CloudNode, inParent: boolean): string {
  const inPart = inParent && n.clusterId ? ` in ${n.clusterId}` : ''
  return `service ${n.id}(${n.type})[${escapeLabel(n.label)}]${inPart}`
}

function groupLine(c: CloudCluster): string {
  const inPart = c.parentClusterId ? ` in ${c.parentClusterId}` : ''
  const typePart = c.type ? `(${c.type})` : ''
  return `group ${c.id}${typePart} [${escapeLabel(c.label)}]${inPart}`
}

function edgeLine(e: CloudEdge): string {
  // Nuestra gramática soporta -->, -.-> y <-->. No hay variante dashed-bidir,
  // así que priorizamos: bidireccional > dashed > sólido.
  const arrow = e.direction === 'both' ? '<-->' : e.style === 'dashed' ? '-.->' : '-->'
  let line = `${e.from} ${arrow} ${e.to}`
  if (e.label) {
    const lbl = escapeLabel(e.label)
    line += ` : ${needsQuotes(lbl) ? `"${lbl}"` : lbl}`
  }
  return line
}

export function serializeCloud(graph: CloudGraph): string {
  const lines: string[] = [...HEADER_COMMENT, `arch-cloud ${graph.direction.toLowerCase()}`, '']

  // Índices de jerarquía.
  const nodesByCluster = new Map<string, CloudNode[]>()
  for (const n of graph.nodes) {
    if (!n.clusterId) continue
    const arr = nodesByCluster.get(n.clusterId) ?? []
    arr.push(n)
    nodesByCluster.set(n.clusterId, arr)
  }
  const subClusters = new Map<string, CloudCluster[]>()
  for (const c of graph.clusters) {
    if (!c.parentClusterId) continue
    const arr = subClusters.get(c.parentClusterId) ?? []
    arr.push(c)
    subClusters.set(c.parentClusterId, arr)
  }

  // Servicios de nivel raíz (sin cluster).
  const topNodes = graph.nodes.filter((n) => !n.clusterId)
  for (const n of topNodes) lines.push(serviceLine(n, false))
  if (topNodes.length) lines.push('')

  // Clusters de nivel raíz, recursivamente con sus contenidos.
  const emitCluster = (c: CloudCluster): void => {
    lines.push(groupLine(c))
    for (const n of nodesByCluster.get(c.id) ?? []) lines.push(serviceLine(n, true))
    for (const sub of subClusters.get(c.id) ?? []) emitCluster(sub)
  }
  const topClusters = graph.clusters.filter((c) => !c.parentClusterId)
  for (const c of topClusters) {
    emitCluster(c)
    lines.push('')
  }

  // Aristas.
  for (const e of graph.edges) lines.push(edgeLine(e))

  // Una sola línea en blanco final.
  return lines.join('\n').replace(/\n+$/, '\n')
}
