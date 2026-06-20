import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { DiagramKind } from '../kind'

// ──────────────────────────────────────────────────────────────────────────
// Estado del editor
//
// El render y la interacción (selección, drag, conexión, zoom, delete) los
// gestiona React Flow internamente. Este store solo mantiene la metadata del
// documento: qué diagrama está cargado, de qué archivo, y si hay cambios sin
// guardar.
// ──────────────────────────────────────────────────────────────────────────

export interface DiagramData {
  /** Tipo de diagrama. Hoy solo `cloud`. */
  kind: DiagramKind
  /** Modelo de dominio parseado del archivo fuente (CloudGraph para cloud). */
  model: unknown
  /** Resultado del layout con coordenadas absolutas (LayoutResult para cloud). */
  layout: unknown
  /** Nombre del diagrama para mostrar en la toolbar. */
  name: string
  /** Bounding box absoluto del contenido. */
  bounds: { width: number; height: number }
}

export interface EditorState {
  diagram: DiagramData | null
  filePath: string | null
  /** Contenido raw del archivo (DSL), base para detectar cambios. */
  sourceContent: string | null
  /** true si el estado en memoria difiere del último guardado. */
  dirty: boolean
  /** Contador que solo aumenta al cargar un layout EXTERNO (archivo / hot
   * reload). El canvas lo usa para re-sembrar y reencuadrar solo entonces; las
   * ediciones del usuario (updateLayout) no lo tocan, así el zoom se conserva. */
  externalRev: number
  /** Si la próxima re-siembra (al cambiar externalRev) debe reencuadrar con
   * fitView. El editor de código en vivo la pone en false: re-siembra los
   * nodos del nuevo DSL pero conserva zoom/pan para no saltar en cada tecla. */
  fitOnSeed: boolean

  setDiagram: (
    diagram: DiagramData,
    filePath: string,
    sourceContent: string,
    opts?: { fit?: boolean }
  ) => void
  clearDiagram: () => void
  updateLayout: (layout: unknown, bounds: { width: number; height: number }) => void
  markDirty: () => void
  /** Marca el estado como guardado. Si se pasa `sourceContent`, lo actualiza al
   * texto recién escrito a disco, para que el eco del file watcher (mismo
   * contenido) se ignore y no re-parsee reseteando posiciones. */
  markClean: (sourceContent?: string) => void
}

export const useEditorStore = create<EditorState>()(
  immer((set) => ({
    diagram: null,
    filePath: null,
    sourceContent: null,
    dirty: false,
    externalRev: 0,
    fitOnSeed: true,

    setDiagram: (diagram, filePath, sourceContent, opts) => {
      set((state) => {
        state.diagram = diagram
        state.filePath = filePath
        state.sourceContent = sourceContent
        state.dirty = false
        state.fitOnSeed = opts?.fit ?? true
        // Layout externo: dispara la re-siembra/encuadre del canvas.
        state.externalRev += 1
      })
    },

    clearDiagram: () => {
      set((state) => {
        state.diagram = null
        state.filePath = null
        state.sourceContent = null
        state.dirty = false
        state.externalRev += 1
      })
    },

    updateLayout: (layout, bounds) => {
      set((state) => {
        if (state.diagram) {
          state.diagram.layout = layout
          state.diagram.bounds = bounds
        }
        state.dirty = true
      })
    },

    markDirty: () => {
      set((state) => {
        state.dirty = true
      })
    },

    markClean: (sourceContent) => {
      set((state) => {
        state.dirty = false
        if (sourceContent !== undefined) state.sourceContent = sourceContent
      })
    }
  }))
)
