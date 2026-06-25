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
  type ShapeNode as ShapeFlowNode,
  type GroupNode as GroupFlowNode,
  edgeVisuals,
  toReactFlow
} from '../../../core/layout/kinds/cloud/toReactFlow'
import type {
  ExtraHandles,
  LayoutResult,
  LayoutEdge,
  LayoutNode,
  LayoutCluster
} from '../../../core/parser/kinds/cloud/types'
import { type GuideLine, snapToAlignment } from '../../../core/layout/kinds/cloud/alignment'
import { allExtraHandleIds } from '../../../core/layout/kinds/cloud/connectionHandles'
import {
  defaultGroupSize,
  getGroupStyle,
  isGroupType
} from '../../../core/layout/kinds/cloud/groupStyles'
import { humanizeIconType, ICON_DND_TYPE } from '../../../icons/officialIcons'
import { registerCloudLayout } from '../../../core/state/kinds/cloud/layoutRegistry'
import {
  defaultShapeSize,
  fromShapeNodeType,
  toShapeNodeType
} from '../../../core/layout/kinds/cloud/shapes'
import AlignmentGuides from './AlignmentGuides'
import CloudInspector from './CloudInspector'
import ConnectionPointsEditor from './ConnectionPointsEditor'
import GroupNode from './GroupNode'
import JumpEdge from './JumpEdge'
import ServiceNode from './ServiceNode'
import ShapeNode from './ShapeNode'

// Definidos fuera del componente: React Flow exige referencias estables.
const nodeTypes = { service: ServiceNode, group: GroupNode, shape: ShapeNode }
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

  // Construimos los nodos del layout a partir de los nodos ACTUALES de React
  // Flow (fuente de verdad), no del layout previo: así las altas aparecen, las
  // ediciones se reflejan y los BORRADOS desaparecen (antes un nodo borrado
  // quedaba fantasma en el layout y se re-serializaba al .bachi).
  const prevById = new Map(layout.nodes.map((n) => [n.id, n]))
  const updatedNodes: LayoutNode[] = []
  for (const rfNode of rfNodes) {
    if (rfNode.type === 'group') continue // los grupos van en `clusters`
    const prev = prevById.get(rfNode.id)
    const absPos = getAbsolutePosition(rfNode.id)
    if (rfNode.type === 'service') {
      const clusterId = prev?.clusterId ?? rfNode.parentId ?? undefined
      updatedNodes.push({
        ...prev,
        id: rfNode.id,
        type: prev?.type ?? rfNode.data.iconType,
        label: rfNode.data.label,
        x: absPos.x,
        y: absPos.y,
        width: prev?.width ?? rfNode.width ?? 80,
        height: prev?.height ?? rfNode.height ?? 80,
        ...(clusterId ? { clusterId } : {}),
        extraHandles: rfNode.data.extraHandles
      })
    } else if (rfNode.type === 'shape') {
      const sn = rfNode as ShapeFlowNode
      const clusterId = prev?.clusterId ?? sn.parentId ?? undefined
      updatedNodes.push({
        ...prev,
        id: sn.id,
        type: prev?.type ?? toShapeNodeType(sn.data.shapeType),
        label: sn.data.label,
        x: absPos.x,
        y: absPos.y,
        width: sn.width ?? prev?.width ?? 160,
        height: sn.height ?? prev?.height ?? 80,
        ...(clusterId ? { clusterId } : {}),
        fillColor: sn.data.fillColor,
        strokeColor: sn.data.strokeColor,
        strokeWidth: sn.data.strokeWidth
      })
    }
  }

  // Clusters: se construyen desde los group nodes ACTUALES de React Flow (igual
  // que los nodos), no del layout previo. Así un grupo soltado del panel aparece,
  // los borrados desaparecen y se captura su groupType/posición/label.
  const prevClusterById = new Map(layout.clusters.map((c) => [c.id, c]))
  const updatedClusters: LayoutCluster[] = []
  for (const rfNode of rfNodes) {
    if (rfNode.type !== 'group') continue
    const prev = prevClusterById.get(rfNode.id)
    const absPos = getAbsolutePosition(rfNode.id)
    const parentClusterId = prev?.parentClusterId ?? rfNode.parentId ?? undefined
    const groupType = rfNode.data.groupType ?? prev?.type
    updatedClusters.push({
      ...prev,
      id: rfNode.id,
      label: rfNode.data.label,
      x: absPos.x,
      y: absPos.y,
      width: rfNode.width ?? prev?.width ?? defaultGroupSize().width,
      height: rfNode.height ?? prev?.height ?? defaultGroupSize().height,
      ...(parentClusterId ? { parentClusterId } : {}),
      ...(groupType ? { type: groupType } : {})
    })
  }

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
  background = 'dots',
  minimapVisible = false,
  presentationMode = false
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

  // Refs siempre al día con el estado vivo de React Flow, para que el getter del
  // registro (consultado al guardar) derive el layout exacto que se ve.
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])
  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  // Publica el getter del layout actual mientras este canvas está montado. Al
  // guardar, App lo lee para serializar el .bachi desde el estado vivo (no del
  // store, que puede quedar stale entre ediciones encadenadas).
  useEffect(() => {
    registerCloudLayout(() => {
      const base = layoutRef.current
      if (!base) return null
      const next = updateLayoutWithReactFlow(base, nodesRef.current, edgesRef.current)
      const bounds = getLayoutBounds(next)
      next.width = bounds.width
      next.height = bounds.height
      return next
    })
    return () => registerCloudLayout(null)
  }, [])

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
    // Solo encuadrar si hay contenido. Con canvas vacío no hay nada que
    // encuadrar y además el RAF podría dispararse justo después de que el
    // usuario suelte el primer nodo, haciendo zoom sobre ese único elemento.
    if (n.length === 0 && e.length === 0) return
    // Edición en vivo desde el editor de código: re-sembramos los nodos del
    // nuevo DSL pero NO reencuadramos, para no dar saltos de zoom en cada tecla.
    if (!useEditorStore.getState().fitOnSeed) return
    // Cancelamos el RAF anterior si el efecto se vuelve a ejecutar antes de
    // que haya disparado (evita fitView sobre estado intermedio).
    const rafId = requestAnimationFrame(() => fitView({ padding: 0.15, duration: 200 }))
    return () => cancelAnimationFrame(rafId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalRev])

  // Al ENTRAR en modo presentación, encuadra el diagrama para una vista limpia y
  // centrada. En uso normal no toca el viewport (el usuario conserva zoom/pan).
  useEffect(() => {
    if (!presentationMode) return
    const rafId = requestAnimationFrame(() => fitView({ padding: 0.08, duration: 400 }))
    return () => cancelAnimationFrame(rafId)
  }, [presentationMode, fitView])

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
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })

      // Grupo (prefijo */groups/) → contenedor con estilo (GroupNode).
      if (isGroupType(iconType)) {
        const { width, height } = defaultGroupSize()
        const position = { x: p.x - width / 2, y: p.y - height / 2 }
        setNodes((nds) => {
          const slug = iconType.split('/').pop() ?? 'group'
          const newNode: CloudFlowNode = {
            id: uniqueNodeId(slug, nds),
            type: 'group',
            position,
            data: {
              label: getGroupStyle(iconType)?.label ?? humanizeIconType(iconType),
              groupType: iconType
            },
            width,
            height,
            zIndex: 0
          }
          const next = [...nds, newNode]
          syncToStore(next, edges)
          return next
        })
        markDirty()
        return
      }

      // Figura básica (prefijo oss/shapes/) → ShapeNode; el resto → ServiceNode.
      const shapeType = fromShapeNodeType(iconType)
      if (shapeType) {
        const { width, height } = defaultShapeSize(shapeType)
        const position = { x: p.x - width / 2, y: p.y - height / 2 }
        setNodes((nds) => {
          const slug = shapeType.replace(/-/g, '')
          const newNode: CloudFlowNode = {
            id: uniqueNodeId(slug, nds),
            type: 'shape',
            position,
            data: {
              label: humanizeIconType(iconType),
              shapeType: shapeType as ShapeFlowNode['data']['shapeType'],
              fillColor: '#ffffff',
              strokeColor: '#334155',
              strokeWidth: 2
            },
            width,
            height,
            zIndex: 1
          }
          const next = [...nds, newNode]
          syncToStore(next, edges)
          return next
        })
      } else {
        // Icono cloud normal (80×80), centrado en el cursor.
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
      }
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
      // Fin de un resize (NodeResizer): el último cambio de dimensiones llega con
      // resizing=false. Persistimos el nuevo tamaño al store (durante el arrastre,
      // resizing=true, lo dejamos pasar sin sincronizar para no saturar).
      const resizeEnded = changes.some((c) => c.type === 'dimensions' && c.resizing === false)
      if (hasRemoveOrReplace || resizeEnded) {
        setNodes((nds) => {
          syncToStore(nds, edges)
          return nds
        })
        if (resizeEnded) markDirty()
      }
    },
    [onNodesChange, setNodes, syncToStore, markDirty, edges]
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

  // Fija propiedades visuales de un nodo shape (fill, stroke, strokeWidth).
  const setShapeData = useCallback(
    (nodeId: string, patch: Partial<ShapeFlowNode['data']>) => {
      setNodes((nds) => {
        const next = nds.map((n) =>
          n.id === nodeId && n.type === 'shape'
            ? ({ ...n, data: { ...n.data, ...patch } } as CloudFlowNode)
            : n
        )
        syncToStore(next, edges)
        return next
      })
      markDirty()
    },
    [setNodes, syncToStore, markDirty, edges]
  )

  // Cambia el tipo de grupo (su estilo del catálogo) de un cluster.
  const setGroupType = useCallback(
    (nodeId: string, groupType: string) => {
      setNodes((nds) => {
        const next = nds.map((n) =>
          n.id === nodeId && n.type === 'group'
            ? ({ ...n, data: { ...n.data, groupType } } as CloudFlowNode)
            : n
        )
        syncToStore(next, edges)
        return next
      })
      markDirty()
    },
    [setNodes, syncToStore, markDirty, edges]
  )

  // Elemento para el inspector: solo con selección única (un nodo o una arista).
  // Con 0 o múltiples seleccionados, el panel no se muestra.
  const single = selectedNodeIds.length + selectedEdgeIds.length === 1
  const selectedNode =
    single && selectedNodeIds.length === 1
      ? (nodes.find((n) => n.id === selectedNodeIds[0]) ?? null)
      : null
  const inspectorServiceNode = selectedNode?.type === 'service' ? selectedNode : null
  const inspectorShapeNode = selectedNode?.type === 'shape' ? (selectedNode as ShapeFlowNode) : null
  const inspectorGroupNode = selectedNode?.type === 'group' ? (selectedNode as GroupFlowNode) : null
  const inspectorEdge =
    single && selectedEdgeIds.length === 1
      ? (edges.find((e) => e.id === selectedEdgeIds[0]) ?? null)
      : null

  // Estilo Lucid: SOLO la arista seleccionada es reconectable. React Flow pone
  // anclajes de extremo (`react-flow__edgeupdater`) en TODA arista reconectable,
  // y cuando dos comparten un punto, el anclaje de la de encima intercepta el
  // arrastre (movía la que no era). Al activar la reconexión únicamente en la
  // seleccionada, sus anclajes (los "cuadraditos") son los únicos vivos en ese
  // punto y arrastran justo esa arista, sin importar cuál se conectó primero.
  // Además la elevamos (zIndex) para que quede por encima. Las no seleccionadas
  // conservan su referencia salvo que haya que apagarles la reconexión.
  const edgesForFlow = useMemo(
    () =>
      edges.map((e) => {
        const active = !!e.selected && !presentationMode
        if (active) return { ...e, zIndex: 1000, reconnectable: true }
        if (e.reconnectable === false && !e.zIndex) return e
        return { ...e, reconnectable: false, zIndex: 0 }
      }),
    [edges, presentationMode]
  )

  if (!layout) return <div className="bachi-draw-canvas" />

  return (
    // Evita el menú contextual nativo del SO: el clic derecho se usa para pan.
    <div
      className="bachi-draw-canvas"
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edgesForFlow}
        onNodesChange={onNodesChangeWrapped}
        onEdgesChange={onEdgesChangeWrapped}
        onConnect={onConnect}
        onReconnectStart={onReconnectStart}
        onReconnect={onReconnect}
        onReconnectEnd={onReconnectEnd}
        onNodeDoubleClick={presentationMode ? undefined : onNodeDoubleClick}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        // En modo presentación el lienzo es solo-lectura: nada de mover, conectar,
        // seleccionar ni reconectar. Solo queda navegar (pan/zoom).
        nodesDraggable={!presentationMode}
        nodesConnectable={!presentationMode}
        elementsSelectable={!presentationMode}
        edgesReconnectable={!presentationMode}
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
        // En presentación, arrastrar con el botón izquierdo hace pan (modo visor)
        // y no hay caja de selección. En edición: izq = selección, der = pan.
        panOnDrag={presentationMode ? true : [2]}
        selectionOnDrag={!presentationMode}
        selectionMode={SelectionMode.Partial}
        // Rueda del ratón → desplazar el lienzo (pan vertical/horizontal), no zoom.
        // Ctrl/Cmd + rueda → zoom (estilo Figma/Lucid). El pinch del trackpad
        // sigue haciendo zoom vía zoomOnPinch (activo por defecto).
        panOnScroll
        zoomActivationKeyCode={['Control', 'Meta']}
        minZoom={0.1}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={background === 'lines' ? BackgroundVariant.Lines : BackgroundVariant.Dots}
          gap={24}
          // Los puntos necesitan un radio algo mayor para leerse; las líneas, 1px.
          size={background === 'lines' ? 1 : 1.6}
        />
        {/* Los controles de zoom son chrome de edición: se ocultan al presentar. */}
        {!presentationMode ? <Controls /> : null}
        {/* Minimapa opcional (preferencia persistente). Abajo-izquierda, justo a
            la derecha de los Controls (anulamos el margen y lo desplazamos con
            left para que queden uno al lado del otro sin solaparse). Como el
            inspector ocupa todo el borde derecho, aquí nunca queda tapado ni
            salta al abrir el panel. */}
        {minimapVisible ? (
          <MiniMap
            pannable
            zoomable
            position="bottom-left"
            style={{ width: 160, height: 110, margin: 0, left: 56, bottom: 14 }}
          />
        ) : null}
        <AlignmentGuides guides={guides} />
      </ReactFlow>

      {/* Panel inspector contextual (superpuesto a la derecha). Oculto al presentar. */}
      {!presentationMode && (
        <CloudInspector
          serviceNode={inspectorServiceNode}
          shapeNode={inspectorShapeNode}
          groupNode={inspectorGroupNode}
          edge={inspectorEdge}
          onEditConnectionPoints={(id) => setEditorNodeId(id)}
          onToggleJumps={toggleJumps}
          onSetEdgeStyle={(id, style) => setEdgeData(id, { style })}
          onSetEdgeDirection={(id, direction) => setEdgeData(id, { direction })}
          onSetShapeData={setShapeData}
          onSetGroupType={setGroupType}
        />
      )}

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
