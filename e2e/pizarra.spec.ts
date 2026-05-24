import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import {
  launchApp,
  loadDocument,
  loadEmptyPizarra,
  emptyPizarra,
  excalidrawCanvasBox,
  drawRectangle,
  drawWithTool,
  dragMouse,
  saveAndReadScene,
  type Point
} from './helpers'

// Estos tests NO validan funciones de Excalidraw (crear figuras, estilos…): eso
// es responsabilidad de Excalidraw. Validan que la PIZARRA funcione fluida dentro
// de esta app Electron: que la interacción no se congele tras sincronizar estado,
// que la UI de Bachi se adapte al modo pizarra, y que el guardado/recarga del
// archivo .dark funcionen de extremo a extremo.

let app: ElectronApplication
let page: Page
let pizarraPath: string

test.beforeEach(async () => {
  ;({ app, page } = await launchApp())
  pizarraPath = path.join(os.tmpdir(), `bachi-e2e-${Date.now()}.dark`)
  await fs.writeFile(pizarraPath, emptyPizarra(), 'utf-8')
})

test.afterEach(async () => {
  await app?.close()
  await fs.rm(pizarraPath, { force: true })
})

// Espera a que el estado del lienzo se sincronice al store (debounce ~400ms): el
// contador de la barra de estado pasa a reflejar el nº de elementos. Ese era el
// instante en el que (con el bug) las figuras quedaban congeladas.
async function waitForStoreSync(count: number): Promise<void> {
  await expect(page.locator('.bachi-draw-status-bar')).toContainText(`${count} elementos`)
}

test('la pantalla inicial ofrece abrir diagrama y crear pizarra', async () => {
  const emptyState = page.locator('.bachi-draw-empty-state')
  await expect(emptyState).toBeVisible()
  await expect(emptyState.getByText('Abrir diagrama .bachi')).toBeVisible()
  await expect(emptyState.getByRole('button', { name: /Nueva pizarra/ })).toBeVisible()
})

test('abrir un .dark monta la pizarra y adapta la UI de Bachi al modo pizarra', async () => {
  await loadDocument(app, pizarraPath, emptyPizarra('Mi pizarra'))

  await expect(page.locator('.excalidraw')).toBeVisible()
  // En modo pizarra no aplican los controles cloud:
  await expect(page.locator('.bachi-draw-figures')).toHaveCount(0) // panel de figuras
  await expect(page.getByRole('button', { name: 'Código' })).toHaveCount(0) // editor DSL
  // El título refleja el nombre y el guardar apunta al .dark.
  await expect(page.locator('.bachi-draw-header-title')).toHaveText('Mi pizarra')
  await expect(page.getByRole('button', { name: 'Guardar' })).toHaveAttribute(
    'title',
    'Guardar pizarra (.dark)'
  )
})

test('la barra de estado refleja el número de figuras del lienzo', async () => {
  await loadEmptyPizarra(app, page, pizarraPath)
  await drawRectangle(page, await canvasCenter(), { w: 160, h: 110 })
  await waitForStoreSync(1)
})

// REGRESIÓN del bug reportado: al añadir una figura y, tras una pausa (cuando el
// estado se sincroniza al store de Immer), intentar moverla, el lienzo se
// "congelaba" y la figura no se podía mover. Debe poder moverse.
test('tras sincronizar el estado, la figura se sigue pudiendo mover (no se congela)', async () => {
  await loadEmptyPizarra(app, page, pizarraPath)
  const box = await excalidrawCanvasBox(page)
  const origin: Point = { x: box.x + box.width * 0.45, y: box.y + box.height * 0.4 }
  const size = { w: 160, h: 110 }
  await drawRectangle(page, origin, size)

  // Esperamos a que el estado se sincronice (el punto donde antes se congelaba).
  await waitForStoreSync(1)

  // La figura sigue seleccionada: arrastrar su centro debe moverla de verdad.
  const center: Point = { x: origin.x + size.w / 2, y: origin.y + size.h / 2 }
  await dragMouse(page, center, { x: center.x + 200, y: center.y + 120 })

  const scene = await saveAndReadScene(page, pizarraPath)
  expect(scene.elements).toHaveLength(1)
  const drawnX = origin.x - box.x
  expect(scene.elements[0].x).toBeGreaterThan(drawnX + 100)
})

test('la interacción sigue fluida: mover con pausas entre medias acumula el desplazamiento', async () => {
  await loadEmptyPizarra(app, page, pizarraPath)
  const box = await excalidrawCanvasBox(page)
  const origin: Point = { x: box.x + box.width * 0.4, y: box.y + box.height * 0.35 }
  const size = { w: 150, h: 100 }
  await drawRectangle(page, origin, size)
  await waitForStoreSync(1)

  // Tres movimientos, cada uno tras una nueva sincronización del store.
  let from: Point = { x: origin.x + size.w / 2, y: origin.y + size.h / 2 }
  for (let i = 0; i < 3; i++) {
    const to: Point = { x: from.x + 70, y: from.y + 50 }
    await dragMouse(page, from, to)
    await page.waitForTimeout(500) // deja que el debounce sincronice otra vez
    from = to
  }

  const scene = await saveAndReadScene(page, pizarraPath)
  expect(scene.elements).toHaveLength(1)
  // Tras 3 desplazamientos acumulados la figura quedó claramente desplazada.
  const drawnX = origin.x - box.x
  expect(scene.elements[0].x).toBeGreaterThan(drawnX + 120)
})

test('tras sincronizar, añadir más figuras sigue funcionando', async () => {
  await loadEmptyPizarra(app, page, pizarraPath)
  const box = await excalidrawCanvasBox(page)
  await drawRectangle(
    page,
    { x: box.x + box.width * 0.3, y: box.y + box.height * 0.35 },
    { w: 110, h: 90 }
  )
  await waitForStoreSync(1)

  // Añadir otra figura después de la sincronización.
  await drawWithTool(
    page,
    'ellipse',
    { x: box.x + box.width * 0.6, y: box.y + box.height * 0.35 },
    { w: 110, h: 90 }
  )
  await waitForStoreSync(2)

  const scene = await saveAndReadScene(page, pizarraPath)
  expect(scene.elements).toHaveLength(2)
})

test('guardar y volver a abrir el .dark conserva el contenido (persistencia)', async () => {
  await loadEmptyPizarra(app, page, pizarraPath)
  const box = await excalidrawCanvasBox(page)
  await drawRectangle(
    page,
    { x: box.x + box.width * 0.4, y: box.y + box.height * 0.4 },
    { w: 150, h: 100 }
  )
  await waitForStoreSync(1)

  const saved = await saveAndReadScene(page, pizarraPath)
  expect(saved.elements).toHaveLength(1)

  // Vaciar el lienzo y comprobar que queda en 0. Usamos un nombre distinto: el
  // app ignora recargas con contenido idéntico al actual (evita ecos), así que
  // el contenido debe diferir del que ya está cargado.
  await loadDocument(app, pizarraPath, emptyPizarra('Lienzo vacío'))
  await waitForStoreSync(0)

  // …y al reabrir el .dark guardado (como un hot reload) la figura vuelve.
  await loadDocument(app, pizarraPath, JSON.stringify(saved))
  await waitForStoreSync(1)
  await expect(page.locator('.excalidraw')).toBeVisible()
})

// Centro del canvas como punto de dibujo, lejos del panel de propiedades izq.
async function canvasCenter(): Promise<Point> {
  const box = await excalidrawCanvasBox(page)
  return { x: box.x + box.width * 0.45, y: box.y + box.height * 0.4 }
}
