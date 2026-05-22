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

  setDiagram: (diagram: DiagramData, filePath: string, sourceContent: string) => void
  clearDiagram: () => void
  updateLayout: (layout: unknown, bounds: { width: number; height: number }) => void
  markDirty: () => void
  markClean: () => void
}

export const useEditorStore = create<EditorState>()(
  immer((set) => ({
    diagram: null,
    filePath: null,
    sourceContent: null,
    dirty: false,
    externalRev: 0,

    setDiagram: (diagram, filePath, sourceContent) => {
      set((state) => {
        state.diagram = diagram
        state.filePath = filePath
        state.sourceContent = sourceContent
        state.dirty = false
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

    markClean: () => {
      set((state) => {
        state.dirty = false
      })
    }
  }))
)
