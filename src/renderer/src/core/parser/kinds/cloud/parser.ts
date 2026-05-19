import yaml from 'js-yaml'
import type {
  CloudCluster,
  CloudEdge,
  CloudGraph,
  CloudNode,
  Direction,
  EdgeDirection,
  EdgeStyle
} from './types'

interface RawNode {
  id?: unknown
  type?: unknown
  label?: unknown
}

interface RawCluster {
  id?: unknown
  label?: unknown
  nodes?: unknown
  clusters?: unknown
}

interface RawEdge {
  from?: unknown
  to?: unknown
  label?: unknown
  style?: unknown
  direction?: unknown
}

interface RawDoc {
  name?: unknown
  direction?: unknown
  nodes?: unknown
  clusters?: unknown
  edges?: unknown
}

export class CloudParseError extends Error {}

function asString(value: unknown, field: string, context: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new CloudParseError(`${context}: el campo "${field}" debe ser un string no vacío`)
  }
  return value
}

function asOptionalString(value: unknown, field: string, context: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') {
    throw new CloudParseError(`${context}: el campo "${field}" debe ser un string`)
  }
  return value
}

function parseDirection(value: unknown): Direction {
  if (value === undefined || value === null) return 'LR'
  if (value === 'LR' || value === 'TB') return value
  throw new CloudParseError(`"direction" debe ser "LR" o "TB", recibido: ${String(value)}`)
}

function parseEdgeStyle(value: unknown): EdgeStyle {
  if (value === undefined || value === null) return 'solid'
  if (value === 'solid' || value === 'dashed') return value
  throw new CloudParseError(`"style" debe ser "solid" o "dashed", recibido: ${String(value)}`)
}

function parseEdgeDirection(value: unknown): EdgeDirection {
  if (value === undefined || value === null) return 'forward'
  if (value === 'forward' || value === 'back' || value === 'both') return value
  throw new CloudParseError(
    `"direction" de edge debe ser "forward" | "back" | "both", recibido: ${String(value)}`
  )
}

interface CollectContext {
  nodes: CloudNode[]
  clusters: CloudCluster[]
  seenIds: Set<string>
}

function registerId(ctx: CollectContext, id: string, kind: 'nodo' | 'cluster'): void {
  if (ctx.seenIds.has(id)) {
    throw new CloudParseError(`ID duplicado "${id}" usado en ${kind}`)
  }
  ctx.seenIds.add(id)
}

function collectNode(raw: RawNode, clusterId: string | undefined, ctx: CollectContext): CloudNode {
  const id = asString(raw.id, 'id', 'nodo')
  const type = asString(raw.type, 'type', `nodo "${id}"`)
  const label = asOptionalString(raw.label, 'label', `nodo "${id}"`) ?? id
  registerId(ctx, id, 'nodo')
  const node: CloudNode = { id, type, label, clusterId }
  ctx.nodes.push(node)
  return node
}

function collectCluster(
  raw: RawCluster,
  parentClusterId: string | undefined,
  ctx: CollectContext
): CloudCluster {
  const id = asString(raw.id, 'id', 'cluster')
  const label = asString(raw.label, 'label', `cluster "${id}"`)
  registerId(ctx, id, 'cluster')

  const cluster: CloudCluster = {
    id,
    label,
    nodeIds: [],
    childClusterIds: [],
    parentClusterId
  }
  ctx.clusters.push(cluster)

  if (raw.nodes !== undefined && raw.nodes !== null) {
    if (!Array.isArray(raw.nodes)) {
      throw new CloudParseError(`cluster "${id}": "nodes" debe ser una lista`)
    }
    for (const item of raw.nodes) {
      const child = collectNode(item as RawNode, id, ctx)
      cluster.nodeIds.push(child.id)
    }
  }

  if (raw.clusters !== undefined && raw.clusters !== null) {
    if (!Array.isArray(raw.clusters)) {
      throw new CloudParseError(`cluster "${id}": "clusters" debe ser una lista`)
    }
    for (const item of raw.clusters) {
      const child = collectCluster(item as RawCluster, id, ctx)
      cluster.childClusterIds.push(child.id)
    }
  }

  return cluster
}

function buildEdges(raw: unknown, knownIds: Set<string>): CloudEdge[] {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) {
    throw new CloudParseError(`"edges" debe ser una lista`)
  }
  const edges: CloudEdge[] = []
  raw.forEach((item, idx) => {
    const r = item as RawEdge
    const from = asString(r.from, 'from', `edge[${idx}]`)
    const to = asString(r.to, 'to', `edge[${idx}]`)
    const label = asOptionalString(r.label, 'label', `edge[${idx}]`)
    const style = parseEdgeStyle(r.style)
    const direction = parseEdgeDirection(r.direction)

    // Validar que las puntas de la flecha apunten a algo conocido (nodo o cluster).
    if (!knownIds.has(from)) {
      throw new CloudParseError(`edge[${idx}]: "from" referencia id desconocido "${from}"`)
    }
    if (!knownIds.has(to)) {
      throw new CloudParseError(`edge[${idx}]: "to" referencia id desconocido "${to}"`)
    }

    edges.push({
      id: `e_${idx}_${from}__${to}`,
      from,
      to,
      label,
      style,
      direction
    })
  })
  return edges
}

export function parseCloudYaml(yamlText: string): CloudGraph {
  let doc: RawDoc
  try {
    doc = (yaml.load(yamlText) ?? {}) as RawDoc
  } catch (err) {
    throw new CloudParseError(`YAML inválido: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (typeof doc !== 'object' || doc === null) {
    throw new CloudParseError(`El archivo .arch debe contener un objeto YAML en la raíz`)
  }

  const name = asString(doc.name, 'name', 'documento')
  const direction = parseDirection(doc.direction)

  const ctx: CollectContext = { nodes: [], clusters: [], seenIds: new Set() }

  if (doc.nodes !== undefined && doc.nodes !== null) {
    if (!Array.isArray(doc.nodes)) {
      throw new CloudParseError(`"nodes" debe ser una lista`)
    }
    for (const item of doc.nodes) {
      collectNode(item as RawNode, undefined, ctx)
    }
  }

  if (doc.clusters !== undefined && doc.clusters !== null) {
    if (!Array.isArray(doc.clusters)) {
      throw new CloudParseError(`"clusters" debe ser una lista`)
    }
    for (const item of doc.clusters) {
      collectCluster(item as RawCluster, undefined, ctx)
    }
  }

  const edges = buildEdges(doc.edges, ctx.seenIds)

  return {
    name,
    direction,
    nodes: ctx.nodes,
    edges,
    clusters: ctx.clusters
  }
}
