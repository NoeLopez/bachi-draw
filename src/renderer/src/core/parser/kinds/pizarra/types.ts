/** Datos de una pizarra Excalidraw, tal como se persisten en el .dark y se
 * mantienen en el store. Los elementos y archivos se tratan como opacos para
 * no acoplar el core al paquete de Excalidraw. */
export interface PizarraLayout {
  name: string
  elements: readonly unknown[]
  appState: {
    scrollX?: number
    scrollY?: number
    zoom?: { value: number }
    theme?: string
  }
  files: Record<string, unknown>
}

export const EMPTY_PIZARRA_LAYOUT: PizarraLayout = {
  name: '',
  elements: [],
  appState: {},
  files: {}
}
