import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { DiagramKind } from '../kind'
import { moveElements, recomputeBounds } from '../../layout/kinds/cloud/editOps'
import type { LayoutResult } from '../../parser/kinds/cloud/types'

// ──────────────────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────────────────

export type EditMode = 'select' | 'pan' | 'connect'

export type SelectableKind = 'node' | 'edge' | 'cluster'

interface DragState {
  /** Snapshot del layout al iniciar el drag. Cada move recalcula desde aquí
   * para no acumular error de redondeo. */
  snapshotLayout: unknown
  startX: number
  startY: number
  /** true cuando el cursor se movió lo suficiente como para considerarlo un
   * arrastre real (y no un simple click). */
  moved: boolean
}

export interface SelectedItem {
  kind: SelectableKind
  id: string
}

export interface DiagramData {
  /** Tipo de diagrama. Hoy solo `cloud`. */
  kind: DiagramKind
  /** Modelo de dominio parseado del archivo fuente (CloudGraph para cloud). */
  model: unknown
  /** Resultado del layout con coordenadas absolutas (LayoutResult para cloud). */
  layout: unknown
  /** Nombre del diagrama para mostrar en la toolbar. */
  name: string
  /** Bounding box absoluto. Lo usamos para fit-to-container. */
  bounds: { width: number; height: number }
}

export interface EditorState {
  /** Diagrama actualmente cargado, o `null` si no hay archivo abierto. */
  diagram: DiagramData | null
  /** Ruta del archivo fuente abierto. */
  filePath: string | null
  /** Contenido raw del archivo (DSL). Sirve como base para detectar cambios. */
  sourceContent: string | null
  /** Modo activo del editor. */
  mode: EditMode
  /** Items seleccionados. Es un Set inmutable manejado por Immer. */
  selection: SelectedItem[]
  /** Estado del arrastre en curso, o null si no hay drag activo. */
  drag: DragState | null
  /** true si el estado en memoria difiere del último guardado. */
  dirty: boolean

  // ─── Acciones ──────────────────────────────────────────────────────────
  setDiagram: (diagram: DiagramData, filePath: string, sourceContent: string) => void
  clearDiagram: () => void

  setMode: (mode: EditMode) => void

  // ─── Drag ────────────────────────────────────────────────────────────────
  /** Inicia un arrastre desde la posición de pantalla dada. */
  beginDrag: (screenX: number, screenY: number) => void
  /** Actualiza el arrastre con la posición actual de pantalla y el zoom
   * vigente (para convertir delta de pantalla a delta de canvas). */
  updateDrag: (screenX: number, screenY: number, zoom: number) => void
  /** Finaliza el arrastre. Marca dirty solo si hubo movimiento real. */
  endDrag: () => void

  /** Selecciona un item. `additive` = true preserva la selección previa
   * (shift-click); false la reemplaza (click normal). */
  select: (item: SelectedItem, additive: boolean) => void
  /** Vacía la selección. Se llama al hacer click en zona vacía. */
  clearSelection: () => void
  /** Helpers de consulta: comprueba si un id está seleccionado. */
  isSelected: (kind: SelectableKind, id: string) => boolean

  markDirty: () => void
  markClean: () => void
}

// ──────────────────────────────────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────────────────────────────────

export const useEditorStore = create<EditorState>()(
  immer((set, get) => ({
    diagram: null,
    filePath: null,
    sourceContent: null,
    mode: 'select',
    selection: [],
    drag: null,
    dirty: false,

    setDiagram: (diagram, filePath, sourceContent) => {
      set((state) => {
        state.diagram = diagram
        state.filePath = filePath
        state.sourceContent = sourceContent
        state.selection = []
        state.drag = null
        state.dirty = false
      })
    },

    clearDiagram: () => {
      set((state) => {
        state.diagram = null
        state.filePath = null
        state.sourceContent = null
        state.selection = []
        state.drag = null
        state.dirty = false
      })
    },

    setMode: (mode) => {
      set((state) => {
        state.mode = mode
      })
    },

    beginDrag: (screenX, screenY) => {
      const layout = get().diagram?.layout
      if (!layout) return
      set((state) => {
        state.drag = { snapshotLayout: layout, startX: screenX, startY: screenY, moved: false }
      })
    },

    updateDrag: (screenX, screenY, zoom) => {
      const { drag, selection } = get()
      if (!drag) return
      const dx = (screenX - drag.startX) / zoom
      const dy = (screenY - drag.startY) / zoom
      const moved = Math.abs(dx) >= 1 || Math.abs(dy) >= 1
      const snapshot = drag.snapshotLayout as LayoutResult
      const next = moveElements(snapshot, selection, dx, dy)
      set((state) => {
        if (state.diagram) state.diagram.layout = next
        if (state.drag) state.drag.moved = state.drag.moved || moved
      })
    },

    endDrag: () => {
      const { drag, diagram } = get()
      const moved = drag?.moved ?? false
      // Recalcular bounds tras el movimiento (para que fit-to-container
      // encuadre correctamente si algo quedó fuera del bbox original).
      const bounds = diagram && moved ? recomputeBounds(diagram.layout as LayoutResult) : undefined
      set((state) => {
        state.drag = null
        if (moved) {
          state.dirty = true
          if (state.diagram && bounds) state.diagram.bounds = bounds
        }
      })
    },

    select: (item, additive) => {
      set((state) => {
        if (additive) {
          // Toggle: si ya estaba, lo quitamos; si no, lo agregamos.
          const existingIdx = state.selection.findIndex(
            (s) => s.kind === item.kind && s.id === item.id
          )
          if (existingIdx >= 0) {
            state.selection.splice(existingIdx, 1)
          } else {
            state.selection.push(item)
          }
        } else {
          state.selection = [item]
        }
      })
    },

    clearSelection: () => {
      set((state) => {
        state.selection = []
      })
    },

    isSelected: (kind, id) => {
      return get().selection.some((s) => s.kind === kind && s.id === id)
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

// ──────────────────────────────────────────────────────────────────────────
// Selectores
// ──────────────────────────────────────────────────────────────────────────

/** Hook para componentes que solo necesitan saber si un id está seleccionado.
 * Suscripción fina: re-renderiza solo cuando cambia esa entrada específica. */
export function useIsSelected(kind: SelectableKind, id: string): boolean {
  return useEditorStore((state) => state.selection.some((s) => s.kind === kind && s.id === id))
}
