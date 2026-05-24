import { getOfficialIconUrl, listOfficialIconTypes } from './officialIcons'
import { listIconTypes } from './registry'

// Catálogo de tipos de icono para el autocompletado del editor.
//
// El problema: hay tipos que apuntan al MISMO icono (un SVG oficial y un alias
// del registry, p.ej. `aws/api-gateway` y `aws/apigateway`, o `aws/simple-
// storage-service` y `aws/s3`). Si se listan todos, el autocompletado muestra
// duplicados confusos.
//
// La solución: deduplicar por el icono real al que resuelve cada tipo y quedarse
// con UN nombre por icono — el más corto (que suele ser el alias convencional:
// s3, alb, apigateway, ec2…). Los tipos sin icono oficial (placeholders OSS) se
// conservan por su propio nombre.

/** Tipos de icono sugeribles, deduplicados por icono real (nombre más corto). */
export function listSuggestableIconTypes(): string[] {
  // Clave (icono real o placeholder) -> nombre elegido.
  const byKey = new Map<string, string>()

  const consider = (type: string): void => {
    // Los bordes de cluster (groups) no son nodos arrastrables ni declarables.
    if (type.includes('/groups/')) return
    const url = getOfficialIconUrl(type)
    // Sin icono oficial: es un placeholder propio, su clave es él mismo.
    const key = url ?? `placeholder:${type}`
    const current = byKey.get(key)
    if (!current || type.length < current.length) byKey.set(key, type)
  }

  for (const type of listOfficialIconTypes()) consider(type)
  for (const type of listIconTypes()) consider(type)

  return [...byKey.values()].sort()
}
