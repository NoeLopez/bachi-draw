import type { LayoutResult } from '../../../parser/kinds/cloud/types'

// Registro a nivel de módulo: CloudCanvas publica aquí cómo obtener el
// LayoutResult ACTUAL (derivado del estado vivo de React Flow), y el guardado en
// App.tsx lo lee al serializar el .bachi. Así evitamos depender del layout del
// store, que entre ediciones encadenadas (p.ej. borrar un nodo cascada a borrar
// su arista) puede quedar momentáneamente desincronizado por closures stale.
// Al guardar, el estado de React Flow ya está asentado, así que este getter da
// la foto exacta de lo que se ve.
//
// Mismo patrón que el registro de escena de pizarra (sceneRegistry.ts).
let getLayoutFn: (() => LayoutResult | null) | null = null

export function registerCloudLayout(fn: (() => LayoutResult | null) | null): void {
  getLayoutFn = fn
}

export function getCloudLayout(): LayoutResult | null {
  return getLayoutFn ? getLayoutFn() : null
}
