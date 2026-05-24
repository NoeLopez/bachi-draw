import type { DiagramKind, DiagramResult } from './kind'
import { getKindDef } from './registry'

// Patrón del header: `arch-cloud`, `arch-bpmn`, etc.
// Busca la primera línea no vacía que no sea comentario y exige el header válido.
const HEADER_RE = /^\s*arch-([a-z][a-z0-9-]*)\b/m

/**
 * Detecta el tipo de diagrama del contenido fuente. Para archivos `.dark`
 * espera JSON con `kind: "pizarra"`; para `.bachi` lee el header `arch-<kind>`.
 */
export function detectKind(source: string): DiagramKind {
  // Archivos .dark son JSON con campo "kind"
  const trimmed = source.trimStart()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(source)
      if (parsed.kind === 'pizarra') return 'pizarra'
    } catch {
      // no es JSON válido, continúa con la detección DSL
    }
  }

  // Saltamos comentarios y líneas vacías al inicio para encontrar el header real.
  const firstSignificant = source
    .split('\n')
    .find((line) => line.trim() !== '' && !line.trim().startsWith('#'))

  const match = firstSignificant?.match(HEADER_RE)
  if (!match) {
    throw new Error(
      'archivo .bachi sin header válido: la primera línea debe ser "arch-<tipo>" (ej. "arch-cloud lr")'
    )
  }
  const candidate = match[1]
  if (candidate === 'cloud') return 'cloud'
  throw new Error(`tipo de diagrama desconocido: arch-${candidate}`)
}

/**
 * Pipeline completo desde texto a resultado renderable. Detecta el tipo,
 * enruta al parser/layout del kind correspondiente y devuelve el resultado.
 */
export async function runPipeline(source: string): Promise<DiagramResult> {
  const kind = detectKind(source)
  const def = getKindDef(kind)
  const model = def.parse(source)
  const layout = await def.layout(model)
  return { kind, model, layout }
}
