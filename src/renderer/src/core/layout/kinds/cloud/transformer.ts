import type { ElkExtendedEdge, ElkNode, LayoutOptions } from 'elkjs'
import type {
  CloudCluster,
  CloudGraph,
  CloudNode,
  Direction
} from '../../../parser/kinds/cloud/types'

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

    // Espacios — más aire entre capas y nodos reduce cruces aparentes y le
    // da a ELK margen para rutear sin que las aristas pasen rasando iconos.
    'elk.layered.spacing.nodeNodeBetweenLayers': '60',
    'elk.spacing.nodeNode': '24',
    'elk.layered.spacing.edgeNodeBetweenLayers': '20',
    // Separación entre rieles paralelos: subida para evitar que aristas
    // distintas queden visualmente solapadas en grafos densos.
    'elk.layered.spacing.edgeEdgeBetweenLayers': '18',
    'elk.spacing.edgeNode': '16',
    'elk.spacing.edgeEdge': '18',

    'elk.padding': '[top=10,left=10,bottom=10,right=10]',
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN',

    // Minimización de cruces: LAYER_SWEEP con un thoroughness moderado.
    // Valores muy altos (>10) en grafos densos a veces empeoran el resultado
    // por sobreoptimizar segmentos individuales.
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.layered.thoroughness': '7',
    'elk.layered.layering.strategy': 'NETWORK_SIMPLEX',

    // Deliberadamente NO usamos mergeEdges: aunque reduce visualmente los
    // canales paralelos, produce "dobles" cerca de los nodos donde la fusión
    // se rompe y dos aristas distintas terminan saliendo casi por el mismo
    // punto del icono. Mejor cada arista en su propio riel.

    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',

    // Elimina bend points colineales y compacta por longitud de arista —
    // solo aplica con ORTHOGONAL.
    'elk.layered.unnecessaryBendpoints': 'true',
    'elk.layered.compaction.postCompaction.strategy': 'EDGE_LENGTH',
    'elk.layered.compaction.postCompaction.constraints': 'QUADRATIC'
  }
}

function clusterLayoutOptions(): LayoutOptions {
  return {
    'elk.padding': '[top=44,left=12,bottom=14,right=12]',
    // El cluster debe ser al menos tan ancho como su label. Sin esto el cluster
    // se dimensiona por sus hijos y el texto se desborda.
    'elk.nodeSize.constraints': '[NODE_LABELS, MINIMUM_SIZE]',
    // El label va dentro del cluster, alineado arriba-izquierda.
    'elk.nodeLabels.placement': '[H_LEFT, V_TOP, INSIDE]'
  }
}

function nodeLayoutOptions(): LayoutOptions {
  return {
    'elk.portConstraints': 'FREE'
  }
}

function buildNode(node: CloudNode): ElkNode {
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
  clustersById: Map<string, CloudCluster>,
  nodesById: Map<string, CloudNode>
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
        // CSS aplica uppercase + letter-spacing 0.3 + weight 600. ~7px/char
        // es suficiente porque el padding del cluster ya añade buffer lateral.
        width: Math.max(80, Math.ceil(cluster.label.length * 7)),
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

export function toElkGraph(graph: CloudGraph): ElkNode {
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
