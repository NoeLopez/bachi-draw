import type { PizarraLayout } from '../../../parser/kinds/pizarra/types'

// Registro a nivel de módulo: PizarraCanvas publica aquí cómo obtener la escena
// actual de Excalidraw, y el guardado en App.tsx la lee sin pasar por el estado
// de React. Así el onChange de Excalidraw NO actualiza el store en cada cambio
// (lo que re-renderizaría App y congelaría el arrastre): Excalidraw queda como
// componente totalmente no-controlado y solo se le consulta al guardar.
//
// Mismo patrón que el registro de saltos de aristas en edgeJumps.ts.
let getSceneFn: (() => PizarraLayout) | null = null

export function registerPizarraScene(fn: (() => PizarraLayout) | null): void {
  getSceneFn = fn
}

export function getPizarraScene(): PizarraLayout | null {
  return getSceneFn ? getSceneFn() : null
}
