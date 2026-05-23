import { useCallback, useEffect, useRef, useState } from 'react'
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
  SelectionMode,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStore,
  type NodeChange,
  type EdgeChange
} from '@xyflow/react'
import { shallow } from 'zustand/shallow'
import '@xyflow/react/dist/style.css'
import type { CanvasProps } from '../../../core/diagram/kind'
import { useEditorStore } from '../../../core/diagram/editor/store'
import {
  type CloudEdgeData,
  type CloudFlowNode,
  edgeVisuals,
  toReactFlow
} from '../../../core/layout/kinds/cloud/toReactFlow'
import type { ExtraHandles, LayoutResult, LayoutEdge } from '../../../core/parser/kinds/cloud/types'
import { type GuideLine, snapToAlignment } from '../../../core/layout/kinds/cloud/alignment'
import { allExtraHandleIds } from '../../../core/layout/kinds/cloud/connectionHandles'
import { humanizeIconType, ICON_DND_TYPE } from '../../../icons/officialIcons'
import AlignmentGuides from './AlignmentGuides'
import CloudInspector from './CloudInspector'
import ConnectionPointsEditor from './ConnectionPointsEditor'
import GroupNode from './GroupNode'
import JumpEdge from './JumpEdge'
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

/** Id de nodo único. Base derivada del tipo de icono (ej. aws/ec2 → ec2) más un
 * sufijo incremental. Comprueba contra TODOS los nodos (service y group). */
function uniqueNodeId(iconType: string, existing: CloudFlowNode[]): string {
  const slug = (iconType.split('/').pop() ?? 'node').replace(/[^a-z0-9-]/gi, '') || 'node'
  const taken = new Set(existing.map((n) => n.id))
  let i = 1
  while (taken.has(`${slug}_${i}`)) i++
  return `${slug}_${i}`
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
      label: rfNode.data.label,
      extraHandles: rfNode.data.extraHandles
    }
  })

  // Anexa nodos service que existen en React Flow pero no en el layout (creados
  // al arrastrar un icono del panel). Sin esto el sync los ignoraría y no se
  // guardarían en el .archd.
  const existingIds = new Set(layout.nodes.map((n) => n.id))
  for (const rfNode of rfNodes) {
    if (rfNode.type !== 'service' || existingIds.has(rfNode.id)) continue
    const absPos = getAbsolutePosition(rfNode.id)
    updatedNodes.push({
      id: rfNode.id,
      type: rfNode.data.iconType,
      label: rfNode.data.label,
      x: absPos.x,
      y: absPos.y,
      width: rfNode.width ?? 80,
      height: rfNode.height ?? 80,
      ...(rfNode.parentId ? { clusterId: rfNode.parentId } : {}),
      extraHandles: rfNode.data.extraHandles
    })
  }

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

function CloudCanvasInner({
  layout,
  background = 'dots'
}: CanvasProps<LayoutResult>): React.JSX.Element {
  const [nodes, setNodes, onNodesChange] = useNodesState<CloudFlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<CloudEdgeData>>([])
  const { fitView, updateNodeData, screenToFlowPosition } = useReactFlow()
  const markDirty = useEditorStore((s) => s.markDirty)
  const updateLayout = useEditorStore((s) => s.updateLayout)
  // Solo aumenta al cargar un layout externo (archivo / hot reload). Es lo único
  // que dispara la re-siembra + fitView; las ediciones del usuario no lo tocan.
  const externalRev = useEditorStore((s) => s.externalRev)
  // Marca si una reconexión tuvo éxito; si se suelta en el vacío, la borramos.
  const reconnectSucceeded = useRef(true)
  // Guías de alineación visibles durante el arrastre de un nodo.
  const [guides, setGuides] = useState<GuideLine[]>([])
  // Nodo cuyo editor de puntos de conexión está abierto (modal).
  const [editorNodeId, setEditorNodeId] = useState<string | null>(null)
  // Ids seleccionados (leídos de React Flow). Devolvemos arrays para que el
  // inspector solo aparezca con selección única; shallow evita renders de más.
  const { selectedNodeIds, selectedEdgeIds } = useStore(
    (s) => ({
      selectedNodeIds: Array.from(s.nodeLookup.values())
        .filter((n) => n.selected)
        .map((n) => n.id),
      selectedEdgeIds: Array.from(s.edgeLookup.values())
        .filter((e) => e.selected)
        .map((e) => e.id)
    }),
    shallow
  )
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

  // Drag & drop desde el panel de figuras: crear un nodo nuevo donde se suelta.
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(ICON_DND_TYPE)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const iconType = e.dataTransfer.getData(ICON_DND_TYPE)
      if (!iconType) return
      e.preventDefault()
      // Posición en coordenadas del lienzo (respeta zoom/pan); centrar el nodo
      // 80x80 en el cursor restando la mitad.
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const position = { x: p.x - 40, y: p.y - 40 }
      setNodes((nds) => {
        const newNode: CloudFlowNode = {
          id: uniqueNodeId(iconType, nds),
          type: 'service',
          position,
          data: { label: humanizeIconType(iconType), iconType },
          width: 80,
          height: 80,
          zIndex: 1
        }
        const next = [...nds, newNode]
        syncToStore(next, edges)
        return next
      })
      markDirty()
    },
    [screenToFlowPosition, setNodes, syncToStore, markDirty, edges]
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

  // Fija una propiedad del data de una arista (estilo, dirección...). Igual que
  // toggleJumps: pasa por setEdges + syncToStore + markDirty (no toca externalRev).
  // Si cambia style/direction, recalcula también los visuales del Edge (markers y
  // dasharray), que es lo que React Flow dibuja, para que el cambio se vea.
  const setEdgeData = useCallback(
    (edgeId: string, patch: Partial<CloudEdgeData>) => {
      setEdges((eds) => {
        const next = eds.map((e) => {
          if (e.id !== edgeId) return e
          const data = { ...e.data, ...patch } as CloudEdgeData
          const { markerEnd, markerStart, strokeDasharray } = edgeVisuals(
            data.style,
            data.direction
          )
          return {
            ...e,
            data,
            markerEnd,
            markerStart,
            style: strokeDasharray
              ? { ...e.style, strokeDasharray }
              : { ...e.style, strokeDasharray: undefined }
          } as Edge<CloudEdgeData>
        })
        syncToStore(nodes, next)
        return next
      })
      markDirty()
    },
    [setEdges, syncToStore, markDirty, nodes]
  )

  // Aplica los puntos extra al nodo. Pasa por setNodes/setEdges + syncToStore
  // (no toca externalRev, así el zoom se conserva). Las aristas que apuntaban a
  // un punto extra que ya no existe se resetean a null (React Flow reengancha al
  // más cercano por connectionMode="loose").
  const applyExtraHandles = useCallback(
    (nodeId: string, extraHandles: ExtraHandles) => {
      const validIds = allExtraHandleIds(extraHandles)
      const orphan = (handle: string | null | undefined, source: boolean, edge: Edge): boolean => {
        const onThisNode = source ? edge.source === nodeId : edge.target === nodeId
        if (!onThisNode || !handle) return false
        // Solo nos importan los handles extra (prefijo 'e'); los centrales y los
        // de otros nodos no se tocan.
        if (!handle.startsWith('e')) return false
        return !validIds.has(handle)
      }

      let nextNodes: CloudFlowNode[] = []
      let nextEdges: Edge<CloudEdgeData>[] = []
      setNodes((nds) => {
        nextNodes = nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, extraHandles } } : n
        ) as CloudFlowNode[]
        return nextNodes
      })
      setEdges((eds) => {
        nextEdges = eds.map((e) => {
          const sh = orphan(e.sourceHandle, true, e) ? null : e.sourceHandle
          const th = orphan(e.targetHandle, false, e) ? null : e.targetHandle
          return sh === e.sourceHandle && th === e.targetHandle
            ? e
            : { ...e, sourceHandle: sh, targetHandle: th }
        })
        return nextEdges
      })
      syncToStore(nextNodes, nextEdges)
      markDirty()
      setEditorNodeId(null)
    },
    [setNodes, setEdges, syncToStore, markDirty]
  )

  // Elemento para el inspector: solo con selección única (un nodo de servicio o
  // una arista). Con 0 o múltiples seleccionados, el panel no se muestra.
  const single = selectedNodeIds.length + selectedEdgeIds.length === 1
  const selectedNode =
    single && selectedNodeIds.length === 1
      ? (nodes.find((n) => n.id === selectedNodeIds[0]) ?? null)
      : null
  const inspectorNode = selectedNode?.type === 'service' ? selectedNode : null
  const inspectorEdge =
    single && selectedEdgeIds.length === 1
      ? (edges.find((e) => e.id === selectedEdgeIds[0]) ?? null)
      : null

  if (!layout) return <div className="diagen-canvas" />

  return (
    // Evita el menú contextual nativo del SO: el clic derecho se usa para pan.
    <div
      className="diagen-canvas"
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
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
        // Radio amplio: al soltar una conexión, React Flow engancha al handle
        // más cercano dentro de este radio. 60px cubre desde el centro de un
        // nodo (80px) a cualquiera de sus 4 puntos, así soltar en cualquier
        // parte de la figura ancla la flecha por el lado más próximo (Lucid).
        connectionRadius={60}
        deleteKeyCode={['Delete', 'Backspace']}
        // Interacción estilo Figma/Lucid:
        //  - Botón izquierdo arrastrando en vacío → caja de selección grupal.
        //  - Botón derecho (código 2) arrastrando → pan del lienzo (la manito).
        //  - Selección parcial: la caja selecciona todo lo que toca.
        panOnDrag={[2]}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        minZoom={0.1}
        maxZoom={3}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={background === 'lines' ? BackgroundVariant.Lines : BackgroundVariant.Dots}
          gap={24}
          size={1}
        />
        <Controls />
        {/* Con el inspector abierto, el minimapa va a la izquierda para no
                quedar tapado por el panel (que está a la derecha). */}
        <MiniMap
          pannable
          zoomable
          position={inspectorNode || inspectorEdge ? 'bottom-left' : 'bottom-right'}
        />
        <AlignmentGuides guides={guides} />
      </ReactFlow>

      {/* Panel inspector contextual (superpuesto a la derecha). */}
      <CloudInspector
        node={inspectorNode}
        edge={inspectorEdge}
        onEditConnectionPoints={(id) => setEditorNodeId(id)}
        onToggleJumps={toggleJumps}
        onSetEdgeStyle={(id, style) => setEdgeData(id, { style })}
        onSetEdgeDirection={(id, direction) => setEdgeData(id, { direction })}
      />

      {/* Modal de edición de puntos de conexión. */}
      {editorNodeId
        ? (() => {
            const node = nodes.find((n) => n.id === editorNodeId)
            if (!node || node.type !== 'service') return null
            return (
              <ConnectionPointsEditor
                label={node.data.label}
                iconType={node.data.iconType}
                width={node.width ?? 80}
                height={node.height ?? 80}
                initial={node.data.extraHandles}
                onCancel={() => setEditorNodeId(null)}
                onSave={(extra) => applyExtraHandles(editorNodeId, extra)}
              />
            )
          })()
        : null}
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
