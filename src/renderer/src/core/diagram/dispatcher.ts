import type { DiagramKind, DiagramResult } from './kind'
import { getKindDef } from './registry'

// Patrón del header: `arch-cloud`, `arch-bpmn`, etc.
// Busca la primera línea no vacía que no sea comentario y exige el header válido.
const HEADER_RE = /^\s*arch-([a-z][a-z0-9-]*)\b/m

/**
 * Detecta el tipo de diagrama del contenido fuente leyendo el header
 * `arch-<kind>` en la primera línea efectiva. Lanza si no hay header o el
 * tipo es desconocido.
 */
export function detectKind(source: string): DiagramKind {
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
