import type { DiagramKind, DiagramResult } from './kind'
import { getKindDef } from './registry'

// Patrón del header del DSL nuevo: `arch-cloud`, `arch-bpmn`, etc.
const HEADER_RE = /^\s*arch-([a-z][a-z0-9-]*)/m

/**
 * Detecta el tipo de diagrama del contenido fuente.
 *
 * Reglas:
 *   - Si la primera línea no vacía y no comentario inicia con `arch-<kind>`,
 *     se usa ese kind (formato DSL nuevo).
 *   - Si no, se asume YAML legacy del tipo cloud (compatibilidad hacia atrás
 *     mientras migramos los `.arch` existentes).
 */
export function detectKind(source: string): DiagramKind {
  const match = source.match(HEADER_RE)
  if (match) {
    const candidate = match[1]
    // Por ahora solo conocemos 'cloud'. Validamos.
    if (candidate === 'cloud') return 'cloud'
    throw new Error(`Tipo de diagrama desconocido: arch-${candidate}`)
  }
  // Fallback: YAML legacy → asumimos cloud.
  return 'cloud'
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
