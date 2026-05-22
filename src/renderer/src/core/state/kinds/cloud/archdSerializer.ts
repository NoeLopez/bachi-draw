import type { ExtraHandles, LayoutResult } from '../../../parser/kinds/cloud/types'

export interface ArchdCanvas {
  zoom: number
  offsetX: number
  offsetY: number
  width: number
  height: number
}

export interface ArchdDocument {
  version: '1.0'
  source: string
  generatedAt: string
  canvas: ArchdCanvas
  nodes: Array<{
    id: string
    type: string
    label: string
    x: number
    y: number
    width: number
    height: number
    extraHandles: ExtraHandles | null
  }>
  clusters: Array<{
    id: string
    label: string
    x: number
    y: number
    width: number
    height: number
  }>
  edges: Array<{
    id: string
    from: string
    to: string
    label: string | null
    style: 'solid' | 'dashed'
    direction: 'forward' | 'back' | 'both'
    points: { x: number; y: number }[]
    sourceHandle: string | null
    targetHandle: string | null
    jumps: boolean
  }>
}

export function serializeArchd(
  sourceFileName: string,
  layout: LayoutResult,
  canvas: ArchdCanvas
): ArchdDocument {
  return {
    version: '1.0',
    source: sourceFileName,
    generatedAt: new Date().toISOString(),
    canvas,
    nodes: layout.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      extraHandles: n.extraHandles ?? null
    })),
    clusters: layout.clusters.map((c) => ({
      id: c.id,
      label: c.label,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height
    })),
    edges: layout.edges.map((e) => ({
      id: e.id,
      from: e.from,
      to: e.to,
      label: e.label ?? null,
      style: e.style,
      direction: e.direction,
      points: e.points,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
      jumps: e.jumps === true
    }))
  }
}
