import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import {
  launchApp,
  loadDocument,
  loadEmptyPizarra,
  emptyPizarra,
  darkWithRectangle,
  darkWithSolidRectangle,
  mockOpenDialog,
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

test('el toggle de tema del header también cambia el tema del lienzo Excalidraw', async () => {
  await loadEmptyPizarra(app, page, pizarraPath)

  const isAppDark = (): Promise<boolean> =>
    page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark')
  const isExcaliDark = async (): Promise<boolean> =>
    (await page.locator('.excalidraw.theme--dark').count()) === 1
  const themeToggle = page.locator('[aria-label^="Tema"]')

  // En todo momento el tema del lienzo debe coincidir con el de la app. Antes del
  // fix, el lienzo se quedaba clavado mientras la app cambiaba. No asumimos el
  // tema inicial (localStorage persiste entre lanzamientos): comprobamos sincronía.
  const dark0 = await isAppDark()
  expect(await isExcaliDark()).toBe(dark0)

  await themeToggle.click()
  expect(await isAppDark()).toBe(!dark0)
  expect(await isExcaliDark()).toBe(!dark0)

  await themeToggle.click()
  expect(await isAppDark()).toBe(dark0)
  expect(await isExcaliDark()).toBe(dark0)
})

// REGRESIÓN: al abrir un archivo teniendo ya una pizarra montada, las figuras
// que vienen del archivo no se podían mover ("congeladas"). Causa: Immer congela
// los elementos del store y Excalidraw los recibe vía updateScene; al intentar
// mutarlos (moverlos / añadir su `index`) fallaba.
test('las figuras cargadas de un archivo se pueden mover (no se congelan al abrir)', async () => {
  // Montar primero una pizarra (fuerza el camino updateScene al abrir el archivo).
  await loadEmptyPizarra(app, page, pizarraPath)

  // Abrir un .dark con una figura sólida en posición conocida (escena 200,150).
  await loadDocument(app, pizarraPath, darkWithSolidRectangle('config', 200, 150))
  await waitForStoreSync(1)
  // El lienzo sigue vivo (no crasheó por elementos no extensibles).
  await expect(page.locator('.excalidraw canvas').first()).toBeVisible()

  // Mover la figura cargada arrastrando desde su interior sólido.
  const box = await excalidrawCanvasBox(page)
  const center: Point = { x: box.x + 200 + 100, y: box.y + 150 + 70 }
  await dragMouse(page, center, { x: center.x + 180, y: center.y + 120 })

  const scene = await saveAndReadScene(page, pizarraPath)
  expect(scene.elements).toHaveLength(1)
  expect(scene.elements[0].x).toBeGreaterThan(200 + 80) // se movió desde x=200
})

test('abrir desde el diálogo reconoce y carga archivos .dark como pizarra', async () => {
  // Escribimos un .dark con una figura y simulamos elegirlo en el diálogo nativo.
  const darkPath = path.join(os.tmpdir(), `bachi-open-${Date.now()}.dark`)
  await fs.writeFile(darkPath, darkWithRectangle('Pizarra abierta'), 'utf-8')
  try {
    await mockOpenDialog(app, darkPath)
    await page.getByRole('button', { name: 'Abrir', exact: true }).click()

    // Se carga como pizarra (Excalidraw montado, UI en modo pizarra) y con su figura.
    await expect(page.locator('.excalidraw')).toBeVisible()
    await expect(page.locator('.bachi-draw-figures')).toHaveCount(0)
    await expect(page.locator('.bachi-draw-header-title')).toHaveText('Pizarra abierta')
    await waitForStoreSync(1)
  } finally {
    await fs.rm(darkPath, { force: true })
  }
})

test('el botón de grilla solo aparece con una pizarra abierta', async () => {
  // Sin documento (pantalla inicial) no hay botón de grilla.
  await expect(page.locator('[aria-label="Grilla"]')).toHaveCount(0)

  await loadEmptyPizarra(app, page, pizarraPath)
  await expect(page.locator('[aria-label="Grilla"]')).toHaveCount(1)
})

test('activar/desactivar la grilla cambia el render del lienzo', async () => {
  await loadEmptyPizarra(app, page, pizarraPath)
  const gridBtn = page.locator('[aria-label="Grilla"]')
  await expect(gridBtn).toBeVisible()

  // Región vacía del centro del lienzo para comparar el render.
  const box = await excalidrawCanvasBox(page)
  const clip = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5, width: 220, height: 160 }

  const stateA = await page.screenshot({ clip })
  await gridBtn.click() // alterna la grilla
  await page.waitForTimeout(300)
  const stateB = await page.screenshot({ clip })

  // El render del lienzo cambió al alternar la grilla (Excalidraw la dibuja).
  expect(Buffer.compare(stateA, stateB)).not.toBe(0)

  // Volver al estado inicial restaura el render.
  await gridBtn.click()
  await page.waitForTimeout(300)
  const stateC = await page.screenshot({ clip })
  expect(Buffer.compare(stateA, stateC)).toBe(0)
})

// Centro del canvas como punto de dibujo, lejos del panel de propiedades izq.
async function canvasCenter(): Promise<Point> {
  const box = await excalidrawCanvasBox(page)
  return { x: box.x + box.width * 0.45, y: box.y + box.height * 0.4 }
}
