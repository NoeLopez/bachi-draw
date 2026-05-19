import type { LayoutResult } from '../parser/types'

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
    points: { x: number; y: number }[]
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
      height: n.height
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
      points: e.points
    }))
  }
}
