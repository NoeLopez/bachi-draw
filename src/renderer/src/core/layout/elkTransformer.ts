import type { ElkExtendedEdge, ElkNode, LayoutOptions } from 'elkjs'
import type { ArchCluster, ArchGraph, ArchNode, Direction } from '../parser/types'

const ROOT_ID = 'root'

export const NODE_SIZE = {
  width: 80,
  height: 80,
  labelOffset: 16
}

const NODE_LABEL_HEIGHT = NODE_SIZE.height + NODE_SIZE.labelOffset

function rootLayoutOptions(direction: Direction): LayoutOptions {
  return {
    'elk.algorithm': 'layered',
    'elk.direction': direction === 'LR' ? 'RIGHT' : 'DOWN',
    'elk.layered.spacing.nodeNodeBetweenLayers': '30',
    'elk.spacing.nodeNode': '10',
    'elk.padding': '[top=10,left=10,bottom=10,right=10]',
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.edgeRouting': 'POLYLINE',
    'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED'
  }
}

function clusterLayoutOptions(): LayoutOptions {
  return {
    'elk.padding': '[top=24,left=8,bottom=8,right=8]'
  }
}

function nodeLayoutOptions(): LayoutOptions {
  return {
    'elk.portConstraints': 'FREE'
  }
}

function buildNode(node: ArchNode): ElkNode {
  return {
    id: node.id,
    width: NODE_SIZE.width,
    height: NODE_LABEL_HEIGHT,
    layoutOptions: nodeLayoutOptions(),
    labels: [{ text: node.label, width: NODE_SIZE.width, height: NODE_SIZE.labelOffset }]
  }
}

function buildClusterTree(
  clusterId: string,
  clustersById: Map<string, ArchCluster>,
  nodesById: Map<string, ArchNode>
): ElkNode {
  const cluster = clustersById.get(clusterId)!
  const children: ElkNode[] = []

  for (const childClusterId of cluster.childClusterIds) {
    children.push(buildClusterTree(childClusterId, clustersById, nodesById))
  }
  for (const nodeId of cluster.nodeIds) {
    const node = nodesById.get(nodeId)
    if (node) children.push(buildNode(node))
  }

  return {
    id: cluster.id,
    layoutOptions: clusterLayoutOptions(),
    children,
    labels: [
      {
        text: cluster.label,
        width: Math.max(60, cluster.label.length * 7),
        height: 18
      }
    ]
  }
}

// Calcula el Lowest Common Ancestor entre dos ids (nodo o cluster) para colocar
// los edges en el contenedor correcto en el árbol de elkjs.
function ancestorChain(id: string, parentOf: Map<string, string>): string[] {
  const chain: string[] = []
  let current: string | undefined = id
  while (current !== undefined) {
    chain.push(current)
    current = parentOf.get(current)
  }
  return chain
}

function lowestCommonAncestor(a: string, b: string, parentOf: Map<string, string>): string {
  const chainA = ancestorChain(a, parentOf)
  const setA = new Set(chainA)
  const chainB = ancestorChain(b, parentOf)
  for (const ancestor of chainB) {
    if (setA.has(ancestor)) return ancestor
  }
  return ROOT_ID
}

function findContainer(node: ElkNode, id: string): ElkNode | null {
  if (node.id === id) return node
  if (!node.children) return null
  for (const child of node.children) {
    const found = findContainer(child, id)
    if (found) return found
  }
  return null
}

export function toElkGraph(graph: ArchGraph): ElkNode {
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]))
  const clustersById = new Map(graph.clusters.map((c) => [c.id, c]))

  // Mapa de "padre" para nodos y clusters. Si no aparece, el padre es ROOT.
  const parentOf = new Map<string, string>()
  for (const node of graph.nodes) {
    parentOf.set(node.id, node.clusterId ?? ROOT_ID)
  }
  for (const cluster of graph.clusters) {
    parentOf.set(cluster.id, cluster.parentClusterId ?? ROOT_ID)
  }

  // Construir hijos del root: clusters de nivel raíz + nodos sin cluster.
  const rootChildren: ElkNode[] = []
  for (const cluster of graph.clusters) {
    if (!cluster.parentClusterId) {
      rootChildren.push(buildClusterTree(cluster.id, clustersById, nodesById))
    }
  }
  for (const node of graph.nodes) {
    if (!node.clusterId) {
      rootChildren.push(buildNode(node))
    }
  }

  const root: ElkNode = {
    id: ROOT_ID,
    layoutOptions: rootLayoutOptions(graph.direction),
    children: rootChildren,
    edges: []
  }

  // Adjuntar cada edge al contenedor correcto (LCA de from/to).
  for (const edge of graph.edges) {
    const containerId = lowestCommonAncestor(edge.from, edge.to, parentOf)
    const container = findContainer(root, containerId) ?? root
    if (!container.edges) container.edges = []
    const elkEdge: ElkExtendedEdge = {
      id: edge.id,
      sources: [edge.from],
      targets: [edge.to]
    }
    if (edge.label) {
      elkEdge.labels = [
        {
          text: edge.label,
          width: Math.max(28, edge.label.length * 6.5),
          height: 14
        }
      ]
    }
    container.edges.push(elkEdge)
  }

  return root
}

export { ROOT_ID }
