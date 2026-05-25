import type { ComponentType } from 'react'
import type { Theme } from '../theme/useTheme'

/** Identificador único de un tipo de diagrama. Cada tipo declara su propio
 * lenguaje (header de archivo), su modelo de dominio, su layout y su renderer. */
export type DiagramKind = 'cloud' | 'pizarra'

/**
 * Resultado de ejecutar el pipeline completo de un tipo de diagrama:
 * parsing + layout. El renderer correspondiente consume este objeto.
 *
 * El `model` es el grafo abstracto crudo (sin coordenadas) — útil para
 * persistir, exportar o ejecutar operaciones de edición sin recurrir
 * al layout cada vez.
 *
 * El `layout` es el modelo enriquecido con coordenadas absolutas listas
 * para renderizar.
 */
export interface DiagramResult<Model = unknown, Layout = unknown> {
  kind: DiagramKind
  model: Model
  layout: Layout
}

/**
 * Definición de un tipo de diagrama. Cada kind registra una entrada con:
 * - cómo parsear texto fuente al modelo
 * - cómo computar layout a partir del modelo
 * - qué componente React renderiza el resultado
 *
 * Cuando se agrega un tipo nuevo (sequence, bpmn, erd...), basta con
 * implementar esta interfaz y registrarlo en el registry.
 */
export interface DiagramStat {
  label: string
  count: number
}

export interface DiagramBounds {
  width: number
  height: number
}

export interface ArchdCanvas {
  zoom: number
  offsetX: number
  offsetY: number
  width: number
  height: number
}

export interface DiagramKindDef<Model = unknown, Layout = unknown> {
  /** Identificador. Coincide con el header del archivo fuente. */
  kind: DiagramKind
  /** Etiqueta humana, usada en UI y mensajes de error. */
  label: string
  /** Parsea el contenido fuente al modelo de dominio. */
  parse: (source: string) => Model
  /** Calcula coordenadas del layout a partir del modelo. */
  layout: (model: Model) => Promise<Layout>
  /** Componente React que renderiza el layout. */
  Canvas: ComponentType<CanvasProps<Layout>>
  /** Nombre del diagrama mostrado en la toolbar. */
  getName: (layout: Layout) => string
  /** Bounding box absoluto del contenido, para fit-to-container. */
  getBounds: (layout: Layout) => DiagramBounds
  /** Conteos para la barra de estado (nodos/edges/clusters en cloud,
   * tasks/gateways/lanes en BPMN, etc.). */
  getStats: (layout: Layout) => DiagramStat[]
  /** Serializa el resultado a JSON persistible (`.bachid` o equivalente). */
  serialize: (fileName: string, layout: Layout, canvas: ArchdCanvas) => unknown
}

/** Patrón de fondo del lienzo, preferencia de vista común a cualquier kind. */
export type CanvasBackground = 'dots' | 'lines'

/**
 * Props comunes que recibe cualquier Canvas de cualquier tipo de diagrama.
 * El viewport (zoom/pan/fit) lo gestiona internamente el renderer (React Flow),
 * por eso el contrato es mínimo: el layout a dibujar y la preferencia de fondo.
 */
export interface CanvasProps<Layout> {
  layout: Layout | null
  /** Patrón de fondo del lienzo. Default: 'dots'. */
  background?: CanvasBackground
  /** Si se muestra el minimapa. Default: false (oculto). */
  minimapVisible?: boolean
  /** Tema actual de la app. El canvas cloud usa variables CSS (data-theme), pero
   * Excalidraw necesita el tema explícito por prop para seguir el toggle. */
  theme?: Theme
  /** Si se muestra la grilla de fondo (solo aplica a la pizarra/Excalidraw). */
  gridEnabled?: boolean
  /** Modo presentación: vista limpia, sin edición ni handles. Default: false.
   * Al activarse, el Canvas encuadra el diagrama y bloquea la interacción de
   * edición (mover/conectar/seleccionar), dejando solo pan y zoom. */
  presentationMode?: boolean
}
