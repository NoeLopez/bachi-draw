import { parseCloudYaml } from '../parser/kinds/cloud/parser'
import { runLayout as runCloudLayout } from '../layout/kinds/cloud/runner'
import { serializeArchd } from '../state/kinds/cloud/archdSerializer'
import CloudCanvas from '../../components/kinds/cloud/CloudCanvas'
import type { CloudGraph, LayoutResult } from '../parser/kinds/cloud/types'
import type { DiagramKind, DiagramKindDef } from './kind'

// Definición del tipo `cloud`. Agregar nuevos tipos (bpmn, sequence, erd...)
// es declarar otra entrada como ésta y registrarla en KIND_REGISTRY.
const cloudKind: DiagramKindDef<CloudGraph, LayoutResult> = {
  kind: 'cloud',
  label: 'Arquitectura cloud',
  parse: parseCloudYaml,
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

const KIND_REGISTRY: Record<DiagramKind, DiagramKindDef<unknown, unknown>> = {
  cloud: cloudKind as DiagramKindDef<unknown, unknown>
}

export function getKindDef(kind: DiagramKind): DiagramKindDef<unknown, unknown> {
  return KIND_REGISTRY[kind]
}

export function listKinds(): DiagramKind[] {
  return Object.keys(KIND_REGISTRY) as DiagramKind[]
}
