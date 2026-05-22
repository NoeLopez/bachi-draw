import { createContext } from 'react'

/**
 * El canvas inyecta por contexto cómo togglear los saltos de una arista, para
 * que el cambio pase por su setEdges + syncToStore (persistencia + dirty) en
 * vez de tocar el estado de React Flow por un atajo. Lo consume la paleta
 * flotante de JumpEdge.
 */
export const EdgeToolsContext = createContext<{ toggleJumps: (id: string) => void } | null>(null)

/**
 * El canvas inyecta cómo abrir el editor de puntos de conexión de un nodo. Lo
 * consume la paleta flotante de ServiceNode (sustituye al menú contextual del
 * clic derecho, que ahora se usa para pan del lienzo).
 */
export const NodeToolsContext = createContext<{
  editConnectionPoints: (id: string) => void
} | null>(null)
