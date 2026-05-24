import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import {
  launchApp,
  loadDocument,
  emptyPizarra,
  drawRectangle,
  excalidrawCanvasBox
} from './helpers'

// Cada test arranca una app Electron fresca: el estado del editor (y la escena de
// Excalidraw) no se comparte entre tests, evitando interferencias.
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

test('la pantalla inicial ofrece abrir diagrama y crear pizarra', async () => {
  const emptyState = page.locator('.bachi-draw-empty-state')
  await expect(emptyState).toBeVisible()
  await expect(emptyState.getByText('Abrir diagrama .bachi')).toBeVisible()
  await expect(emptyState.getByRole('button', { name: /Nueva pizarra/ })).toBeVisible()
})

test('cargar un .dark monta Excalidraw y oculta el panel de figuras', async () => {
  await loadDocument(app, pizarraPath, emptyPizarra('Mi pizarra'))

  await expect(page.locator('.excalidraw')).toBeVisible()
  // El panel de figuras (cloud) no aplica a la pizarra.
  await expect(page.locator('.bachi-draw-figures')).toHaveCount(0)
  // El título del header refleja el nombre del documento.
  await expect(page.locator('.bachi-draw-header-title')).toHaveText('Mi pizarra')
  // El botón de guardar adapta su tooltip al modo pizarra (.dark).
  await expect(page.getByRole('button', { name: 'Guardar' })).toHaveAttribute(
    'title',
    'Guardar pizarra (.dark)'
  )
})

test('dibujar una figura actualiza el contador de la barra de estado', async () => {
  await loadDocument(app, pizarraPath, emptyPizarra())
  await expect(page.locator('.excalidraw')).toBeVisible()

  const box = await excalidrawCanvasBox(page)
  // Dibujamos en el centro del canvas, lejos del panel de propiedades izquierdo
  // (que aparece al activar una herramienta y taparía la esquina superior izq.).
  const origin = { x: box.x + box.width * 0.45, y: box.y + box.height * 0.35 }
  await drawRectangle(page, origin, { w: 160, h: 110 })

  // El contador se refresca tras el debounce (~400ms).
  await expect(page.locator('.bachi-draw-status-bar')).toContainText('1 elementos')
})

test('mover una figura y guardar persiste la nueva posición en el .dark', async () => {
  await loadDocument(app, pizarraPath, emptyPizarra())
  await expect(page.locator('.excalidraw')).toBeVisible()

  const box = await excalidrawCanvasBox(page)
  const origin = { x: box.x + box.width * 0.45, y: box.y + box.height * 0.35 }
  const size = { w: 150, h: 100 }
  await drawRectangle(page, origin, size)

  // Tras dibujar, Excalidraw vuelve a la herramienta de selección y deja la
  // figura seleccionada: la arrastramos desde su centro.
  const center = { x: origin.x + size.w / 2, y: origin.y + size.h / 2 }
  const delta = { x: 200, y: 150 }
  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  await page.mouse.move(center.x + delta.x, center.y + delta.y, { steps: 15 })
  await page.mouse.up()

  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.locator('.bachi-draw-status-bar')).toContainText('Guardado')

  const saved = JSON.parse(await fs.readFile(pizarraPath, 'utf-8'))
  expect(saved.kind).toBe('pizarra')
  expect(saved.elements).toHaveLength(1)
  expect(saved.elements[0].type).toBe('rectangle')
})

test('el arrastre repetido no congela el canvas (regresión del bucle de re-render)', async () => {
  await loadDocument(app, pizarraPath, emptyPizarra())
  await expect(page.locator('.excalidraw')).toBeVisible()

  const box = await excalidrawCanvasBox(page)
  const origin = { x: box.x + box.width * 0.4, y: box.y + box.height * 0.3 }
  const size = { w: 140, h: 90 }
  await drawRectangle(page, origin, size)

  // Tres arrastres consecutivos. Si el bucle de re-render reapareciera, el canvas
  // dejaría de responder y la posición final no reflejaría los tres movimientos.
  let from = { x: origin.x + size.w / 2, y: origin.y + size.h / 2 }
  for (let i = 0; i < 3; i++) {
    const to = { x: from.x + 80, y: from.y + 55 }
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 12 })
    await page.mouse.up()
    from = to
  }

  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.locator('.bachi-draw-status-bar')).toContainText('Guardado')

  const saved = JSON.parse(await fs.readFile(pizarraPath, 'utf-8'))
  expect(saved.elements).toHaveLength(1)
  // Tras 3 arrastres acumulados (+240/+165 en total) la figura quedó muy
  // desplazada respecto a donde se dibujó.
  const sceneOriginX = origin.x - box.x
  expect(saved.elements[0].x).toBeGreaterThan(sceneOriginX + 150)
})
