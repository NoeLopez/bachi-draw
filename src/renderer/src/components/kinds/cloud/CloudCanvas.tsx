import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addEdge,
  Background,
  BackgroundVariant,
  type Connection,
  ConnectionMode,
  Controls,
  type Edge,
  MarkerType,
  MiniMap,
  type Node,
  ReactFlow,
  ReactFlowProvider,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type NodeChange,
  type EdgeChange
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { CanvasProps } from '../../../core/diagram/kind'
import { useEditorStore } from '../../../core/diagram/editor/store'
import {
  type CloudEdgeData,
  type CloudFlowNode,
  toReactFlow
} from '../../../core/layout/kinds/cloud/toReactFlow'
import type { LayoutResult, LayoutEdge } from '../../../core/parser/kinds/cloud/types'
import { type GuideLine, snapToAlignment } from '../../../core/layout/kinds/cloud/alignment'
import AlignmentGuides from './AlignmentGuides'
import GroupNode from './GroupNode'
import JumpEdge from './JumpEdge'
import { EdgeToolsContext } from './edgeTools'
import ServiceNode from './ServiceNode'

// Definidos fuera del componente: React Flow exige referencias estables.
const nodeTypes = { service: ServiceNode, group: GroupNode }
const edgeTypes = { jump: JumpEdge }

/**
 * Genera un id de arista único. Parte de `e_<source>_<target>` con los handles
 * implicados; si ya existe (misma conexión repetida), añade un sufijo numérico.
 * React Flow descarta aristas con id duplicado, así que esto es lo que permite
 * varias flechas entre el mismo par de nodos.
 */
function uniqueEdgeId(c: Connection, existing: Edge<CloudEdgeData>[]): string {
  const handlePart = [c.sourceHandle, c.targetHandle].filter(Boolean).join('-')
  const base = `e_${c.source}_${c.target}${handlePart ? `_${handlePart}` : ''}`
  const taken = new Set(existing.map((e) => e.id))
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base}_${i}`)) i++
  return `${base}_${i}`
}

function updateLayoutWithReactFlow(
  layout: LayoutResult,
  rfNodes: CloudFlowNode[],
  rfEdges: Edge<CloudEdgeData>[]
): LayoutResult {
  const nodesMap = new Map(rfNodes.map((n) => [n.id, n]))

  // Helper to get absolute positions from relative coordinates in React Flow
  const getAbsolutePosition = (nodeId: string): { x: number; y: number } => {
    const node = nodesMap.get(nodeId)
    if (!node) return { x: 0, y: 0 }
    if (!node.parentId) {
      return { x: node.position.x, y: node.position.y }
    }
    const parentPos = getAbsolutePosition(node.parentId)
    return {
      x: node.position.x + parentPos.x,
      y: node.position.y + parentPos.y
    }
  }

  // Update layout nodes with new positions and labels
  const updatedNodes = layout.nodes.map((n) => {
    const rfNode = nodesMap.get(n.id)
    if (!rfNode || rfNode.type !== 'service') return n
    const absPos = getAbsolutePosition(n.id)
    return {
      ...n,
      x: absPos.x,
      y: absPos.y,
      label: rfNode.data.label
    }
  })

  // Update layout clusters with new positions and labels
  const updatedClusters = layout.clusters.map((c) => {
    const rfNode = nodesMap.get(c.id)
    if (!rfNode || rfNode.type !== 'group') return c
    const absPos = getAbsolutePosition(c.id)
    return {
      ...c,
      x: absPos.x,
      y: absPos.y,
      label: rfNode.data.label,
      width: rfNode.width ?? c.width,
      height: rfNode.height ?? c.height
    }
  })

  // Update edges.
  // Match rfEdges back to LayoutEdge.
  const updatedEdges = rfEdges.map((rfEdge): LayoutEdge => {
    const existing = layout.edges.find((e) => e.id === rfEdge.id)
    if (existing) {
      return {
        ...existing,
        from: rfEdge.source,
        to: rfEdge.target,
        // Reconectar puede cambiar el punto de conexión: lo capturamos.
        sourceHandle: rfEdge.sourceHandle ?? null,
        targetHandle: rfEdge.targetHandle ?? null,
        jumps: rfEdge.data?.jumps === true
      }
    }
    // It's a new edge
    return {
      id: rfEdge.id,
      from: rfEdge.source,
      to: rfEdge.target,
      label: rfEdge.label as string | undefined,
      style: (rfEdge.data?.style ?? 'solid') as 'solid' | 'dashed',
      direction: (rfEdge.data?.direction ?? 'forward') as 'forward' | 'back' | 'both',
      sourceHandle: rfEdge.sourceHandle ?? null,
      targetHandle: rfEdge.targetHandle ?? null,
      jumps: rfEdge.data?.jumps === true,
      points: []
    }
  })

  return {
    ...layout,
    nodes: updatedNodes,
    clusters: updatedClusters,
    edges: updatedEdges
  }
}

function getLayoutBounds(layout: LayoutResult): { width: number; height: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const n of layout.nodes) {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + n.width)
    maxY = Math.max(maxY, n.y + n.height)
  }
  for (const c of layout.clusters) {
    minX = Math.min(minX, c.x)
    minY = Math.min(minY, c.y)
    maxX = Math.max(maxX, c.x + c.width)
    maxY = Math.max(maxY, c.y + c.height)
  }

  const width = minX === Infinity ? 0 : maxX - minX + 40
  const height = minY === Infinity ? 0 : maxY - minY + 40
  return { width, height }
}

function CloudCanvasInner({ layout }: CanvasProps<LayoutResult>): React.JSX.Element {
  const [nodes, setNodes, onNodesChange] = useNodesState<CloudFlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<CloudEdgeData>>([])
  const { fitView, updateNodeData } = useReactFlow()
  const markDirty = useEditorStore((s) => s.markDirty)
  const updateLayout = useEditorStore((s) => s.updateLayout)
  // Solo aumenta al cargar un layout externo (archivo / hot reload). Es lo único
  // que dispara la re-siembra + fitView; las ediciones del usuario no lo tocan.
  const externalRev = useEditorStore((s) => s.externalRev)
  // Marca si una reconexión tuvo éxito; si se suelta en el vacío, la borramos.
  const reconnectSucceeded = useRef(true)
  // Guías de alineación visibles durante el arrastre de un nodo.
  const [guides, setGuides] = useState<GuideLine[]>([])
  // Layout más reciente, leído por el efecto de re-siembra sin que éste dependa
  // del layout (así no se re-dispara con cada edición).
  const layoutRef = useRef<LayoutResult | null>(layout)
  useEffect(() => {
    layoutRef.current = layout
  }, [layout])

  const syncToStore = useCallback(
    (currentNodes: CloudFlowNode[], currentEdges: Edge<CloudEdgeData>[]) => {
      if (!layout) return
      const nextLayout = updateLayoutWithReactFlow(layout, currentNodes, currentEdges)
      const bounds = getLayoutBounds(nextLayout)
      nextLayout.width = bounds.width
      nextLayout.height = bounds.height
      updateLayout(nextLayout, bounds)
    },
    [layout, updateLayout]
  )

  // (Re)convierte el layout a nodos/edges de React Flow SOLO cuando llega un
  // layout externo (carga de archivo / hot reload), detectado por externalRev.
  // Las ediciones del usuario (añadir/borrar/mover flechas, toggle de saltos)
  // pasan por updateLayout, que NO toca externalRev, así el zoom se conserva.
  useEffect(() => {
    const current = layoutRef.current
    if (!current) {
      setNodes([])
      setEdges([])
      return
    }
    const { nodes: n, edges: e } = toReactFlow(current)
    setNodes(n)
    setEdges(e)
    // Encuadrar tras pintar el nuevo contenido.
    requestAnimationFrame(() => fitView({ padding: 0.15, duration: 200 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalRev])

  // Crear arista al soltar una conexión entre handles.
  const onConnect = useCallback(
    (c: Connection) => {
      const newEdge: Edge<CloudEdgeData> = {
        // Id único: incluye los handles y, si aún colisiona, un sufijo. Así se
        // permiten varias aristas entre el mismo par de nodos (por lados
        // distintos o repetidas).
        id: uniqueEdgeId(c, edges),
        source: c.source,
        target: c.target,
        sourceHandle: c.sourceHandle,
        targetHandle: c.targetHandle,
        type: 'jump',
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
        reconnectable: true,
        data: { style: 'solid', direction: 'forward' }
      }
      setEdges((eds) => {
        const nextEdges = addEdge(newEdge, eds)
        syncToStore(nodes, nextEdges)
        return nextEdges
      })
      markDirty()
    },
    [setEdges, markDirty, syncToStore, nodes, edges]
  )

  // Reconexión: arrastrar el extremo de una arista existente a otro nodo/lado.
  // Patrón recomendado por React Flow: una bandera detecta si se soltó sobre un
  // handle válido (onReconnect) o en el vacío (entonces se borra en onReconnectEnd).
  const onReconnectStart = useCallback(() => {
    reconnectSucceeded.current = false
  }, [])

  const onReconnect = useCallback(
    (oldEdge: Edge<CloudEdgeData>, newConnection: Connection) => {
      reconnectSucceeded.current = true
      setEdges((eds) => {
        const nextEdges = reconnectEdge(oldEdge, newConnection, eds)
        syncToStore(nodes, nextEdges)
        return nextEdges
      })
      markDirty()
    },
    [setEdges, markDirty, syncToStore, nodes]
  )

  const onReconnectEnd = useCallback(
    (_: MouseEvent | TouchEvent, edge: Edge<CloudEdgeData>) => {
      // Soltada en el vacío: eliminar la arista (comportamiento estándar).
      if (!reconnectSucceeded.current) {
        setEdges((eds) => {
          const nextEdges = eds.filter((e) => e.id !== edge.id)
          syncToStore(nodes, nextEdges)
          return nextEdges
        })
        markDirty()
      }
      reconnectSucceeded.current = true
    },
    [setEdges, markDirty, syncToStore, nodes]
  )

  // Doble click en un nodo → activa edición inline de su label.
  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      updateNodeData(node.id, { editing: true })
    },
    [updateNodeData]
  )

  // Imán de alineación: en cada frame del arrastre, si el centro del nodo queda
  // dentro del umbral del centro de otro nodo, lo enganchamos a esa línea recta
  // (corrigiendo su posición) y mostramos las guías. Los grupos no se enganchan:
  // arrastrar un cluster movería todo su contenido y el snap estorbaría.
  const onNodeDrag = useCallback(
    (_: React.MouseEvent, node: CloudFlowNode) => {
      if (node.type === 'group') {
        if (guides.length) setGuides([])
        return
      }
      const { position, guides: nextGuides } = snapToAlignment(node, nodes)
      setNodes((nds) => nds.map((n) => (n.id === node.id ? { ...n, position } : n)))
      setGuides(nextGuides)
    },
    [nodes, setNodes, guides.length]
  )

  // Al soltar, React Flow emite un último cambio con la posición real del
  // cursor (sin snap), lo que reintroduce la "grada". Reaplicamos el imán sobre
  // la posición final y fijamos esa posición enganchada antes de sincronizar.
  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: CloudFlowNode) => {
      setGuides([])
      let finalNodes = nodes
      if (node.type !== 'group') {
        const { position } = snapToAlignment(node, nodes)
        finalNodes = nodes.map((n) => (n.id === node.id ? { ...n, position } : n))
        setNodes(finalNodes)
      }
      markDirty()
      syncToStore(finalNodes, edges)
    },
    [markDirty, syncToStore, setNodes, nodes, edges]
  )

  const onNodesChangeWrapped = useCallback(
    (changes: NodeChange<CloudFlowNode>[]) => {
      onNodesChange(changes)
      const hasRemoveOrReplace = changes.some((c) => c.type === 'remove' || c.type === 'replace')
      if (hasRemoveOrReplace) {
        setNodes((nds) => {
          syncToStore(nds, edges)
          return nds
        })
      }
    },
    [onNodesChange, setNodes, syncToStore, edges]
  )

  const onEdgesChangeWrapped = useCallback(
    (changes: EdgeChange<Edge<CloudEdgeData>>[]) => {
      onEdgesChange(changes)
      const hasRemove = changes.some((c) => c.type === 'remove')
      if (hasRemove) {
        setEdges((eds) => {
          syncToStore(nodes, eds)
          return eds
        })
      }
    },
    [onEdgesChange, setEdges, syncToStore, nodes]
  )

  // Toggle de saltos de la arista, invocado desde su paleta flotante. Pasa por
  // setEdges + syncToStore para persistir el cambio y marcar dirty.
  const toggleJumps = useCallback(
    (edgeId: string) => {
      setEdges((eds) => {
        const next = eds.map((e) =>
          e.id === edgeId ? { ...e, data: { ...e.data, jumps: !(e.data?.jumps === true) } } : e
        ) as Edge<CloudEdgeData>[]
        syncToStore(nodes, next)
        return next
      })
      markDirty()
    },
    [setEdges, syncToStore, markDirty, nodes]
  )

  const edgeTools = useMemo(() => ({ toggleJumps }), [toggleJumps])

  if (!layout) return <div className="diagen-canvas" />

  return (
    <div className="diagen-canvas">
      <EdgeToolsContext.Provider value={edgeTools}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChangeWrapped}
          onEdgesChange={onEdgesChangeWrapped}
          onConnect={onConnect}
          onReconnectStart={onReconnectStart}
          onReconnect={onReconnect}
          onReconnectEnd={onReconnectEnd}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={['Delete', 'Backspace']}
          minZoom={0.1}
          maxZoom={3}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
          <Controls />
          <MiniMap pannable zoomable />
          <AlignmentGuides guides={guides} />
        </ReactFlow>
      </EdgeToolsContext.Provider>
    </div>
  )
}

/** El provider habilita los hooks de React Flow (useReactFlow) en el árbol. */
export default function CloudCanvas(props: CanvasProps<LayoutResult>): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <CloudCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
