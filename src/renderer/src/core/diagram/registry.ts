import { parseCloudDsl } from '../parser/kinds/cloud/dslParser'
import { runLayout as runCloudLayout } from '../layout/kinds/cloud/runner'
import { serializeArchd } from '../state/kinds/cloud/archdSerializer'
import CloudCanvas from '../../components/kinds/cloud/CloudCanvas'
import PizarraCanvas from '../../components/kinds/pizarra/PizarraCanvas'
import type { CloudGraph, LayoutResult } from '../parser/kinds/cloud/types'
import type { PizarraLayout } from '../parser/kinds/pizarra/types'
import { EMPTY_PIZARRA_LAYOUT } from '../parser/kinds/pizarra/types'
import type { DiagramKind, DiagramKindDef } from './kind'

// Definición del tipo `cloud`. Agregar nuevos tipos (bpmn, sequence, erd...)
// es declarar otra entrada como ésta y registrarla en KIND_REGISTRY.
const cloudKind: DiagramKindDef<CloudGraph, LayoutResult> = {
  kind: 'cloud',
  label: 'Arquitectura cloud',
  parse: parseCloudDsl,
  layout: runCloudLayout,
  Canvas: CloudCanvas,
  getName: (layout) => layout.name,
  getBounds: (layout) => ({ width: layout.width, height: layout.height }),
  getStats: (layout) => [
    { label: 'nodos', count: layout.nodes.length },
    { label: 'edges', count: layout.edges.length },
    { label: 'clusters', count: layout.clusters.length }
  ],
  serialize: (fileName, layout, canvas) => serializeArchd(fileName, layout, canvas)
}

const pizarraKind: DiagramKindDef<PizarraLayout, PizarraLayout> = {
  kind: 'pizarra',
  label: 'Pizarra',
  parse: (source: string): PizarraLayout => {
    try {
      const parsed = JSON.parse(source)
      return {
        name: parsed.name ?? '',
        elements: parsed.elements ?? [],
        appState: parsed.appState ?? {},
        files: parsed.files ?? {}
      }
    } catch {
      return { ...EMPTY_PIZARRA_LAYOUT }
    }
  },
  layout: (model: PizarraLayout): Promise<PizarraLayout> => Promise.resolve(model),
  Canvas: PizarraCanvas,
  getName: (layout) => layout.name,
  getBounds: () => ({ width: 1920, height: 1080 }),
  getStats: (layout) => [{ label: 'elementos', count: layout.elements.length }],
  serialize: (fileName, layout) => ({
    kind: 'pizarra',
    version: 1,
    name: (layout as PizarraLayout).name || fileName.replace(/\.dark$/, ''),
    elements: (layout as PizarraLayout).elements,
    appState: (layout as PizarraLayout).appState,
    files: (layout as PizarraLayout).files
  })
}

const KIND_REGISTRY: Record<DiagramKind, DiagramKindDef<unknown, unknown>> = {
  cloud: cloudKind as DiagramKindDef<unknown, unknown>,
  pizarra: pizarraKind as DiagramKindDef<unknown, unknown>
}

export function getKindDef(kind: DiagramKind): DiagramKindDef<unknown, unknown> {
  return KIND_REGISTRY[kind]
}

export function listKinds(): DiagramKind[] {
  return Object.keys(KIND_REGISTRY) as DiagramKind[]
}
