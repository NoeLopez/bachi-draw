import { test, expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import os from 'os'
import path from 'path'
import { launchApp, loadDocument, emptyPizarra, simpleCloud } from './helpers'

// El chrome de la app (paneles y controles de la toolbar) se adapta al contexto:
//  - sin documento → solo acciones globales (Nuevo, Abrir, Tema)
//  - diagrama cloud → figuras / código (muelle único), fondo/minimapa, guardar
//  - pizarra → guardar, pero sin figuras, código ni fondo/minimapa
// Estos tests fijan ese contrato de visibilidad.

let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  ;({ app, page } = await launchApp())
  // Estado de preferencias determinista: limpiamos localStorage (panel activo,
  // tema…) y recargamos para que el muelle izquierdo arranque en su valor por
  // defecto ('figures'). Así los tests no dependen de ejecuciones previas.
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForSelector('.bachi-draw-header', { timeout: 15_000 })
})

test.afterEach(async () => {
  await app?.close()
})

// Las consultas a botones de la toolbar se acotan al header para no chocar con
// botones homónimos de otras zonas (p. ej. "Abrir" también está en la bienvenida).
function header(p: Page): Locator {
  return p.locator('.bachi-draw-header')
}

test('sin documento: la bienvenida no muestra paneles ni controles de documento', async () => {
  await expect(page.locator('.bachi-draw-empty-state')).toBeVisible()

  // La bienvenida ofrece los tres puntos de entrada.
  const empty = page.locator('.bachi-draw-empty-state')
  await expect(empty.getByRole('button', { name: /Nuevo diagrama/ })).toBeVisible()
  await expect(empty.getByRole('button', { name: /Nueva pizarra/ })).toBeVisible()
  await expect(empty.getByRole('button', { name: /Abrir un archivo/ })).toBeVisible()

  // No hay panel de figuras ni controles de documento sin documento abierto.
  await expect(page.locator('.bachi-draw-figures')).toHaveCount(0)
  await expect(header(page).getByRole('button', { name: 'Guardar' })).toHaveCount(0)
  await expect(header(page).getByRole('button', { name: 'Código' })).toHaveCount(0)
  await expect(header(page).getByRole('button', { name: 'Figuras' })).toHaveCount(0)
  await expect(header(page).getByRole('button', { name: 'Minimapa' })).toHaveCount(0)

  // Sí están las acciones globales.
  await expect(header(page).getByRole('button', { name: 'Nuevo' })).toBeVisible()
  await expect(header(page).getByRole('button', { name: 'Abrir' })).toBeVisible()
})

test('diagrama cloud: muestra figuras por defecto y los controles del lienzo', async () => {
  const cloudPath = path.join(os.tmpdir(), `bachi-e2e-${Date.now()}.bachi`)
  await loadDocument(app, cloudPath, simpleCloud())

  // Por defecto, un diagrama cloud abre con el panel de figuras.
  await expect(page.locator('.bachi-draw-figures')).toBeVisible()
  await expect(page.locator('.bachi-draw-empty-state')).toHaveCount(0)

  // Controles propios del diagrama cloud.
  await expect(header(page).getByRole('button', { name: 'Guardar' })).toBeVisible()
  await expect(header(page).getByRole('button', { name: 'Figuras' })).toBeVisible()
  await expect(header(page).getByRole('button', { name: 'Código' })).toBeVisible()
  await expect(header(page).getByRole('button', { name: 'Minimapa' })).toBeVisible()
})

test('cloud: figuras y código comparten un único muelle (mutuamente excluyentes)', async () => {
  const cloudPath = path.join(os.tmpdir(), `bachi-e2e-${Date.now()}.bachi`)
  await loadDocument(app, cloudPath, simpleCloud())

  // Estado inicial determinista: figuras visible, editor de código oculto.
  await expect(page.locator('.bachi-draw-figures')).toBeVisible()
  await expect(page.locator('.bachi-draw-code')).toHaveCount(0)

  // Abrir Código oculta Figuras (mismo hueco).
  await header(page).getByRole('button', { name: 'Código' }).click()
  await expect(page.locator('.bachi-draw-code')).toBeVisible()
  await expect(page.locator('.bachi-draw-figures')).toHaveCount(0)

  // Volver a Figuras oculta el editor de código.
  await header(page).getByRole('button', { name: 'Figuras' }).click()
  await expect(page.locator('.bachi-draw-figures')).toBeVisible()
  await expect(page.locator('.bachi-draw-code')).toHaveCount(0)

  // El botón cerrar del panel de figuras vacía el muelle.
  await page.locator('.bachi-draw-figures-close').click()
  await expect(page.locator('.bachi-draw-figures')).toHaveCount(0)
  await expect(page.locator('.bachi-draw-code')).toHaveCount(0)
})

test('modo oscuro: grid, minimapa y controles siguen el tema (no quedan en blanco)', async () => {
  // Fijamos tema oscuro, fondo de líneas y minimapa visible, de forma
  // determinista, y recargamos.
  await page.evaluate(() => {
    window.localStorage.setItem('bachi-draw.theme', 'dark')
    window.localStorage.setItem('bachi-draw.canvasBackground', 'lines')
    window.localStorage.setItem('bachi-draw.minimapVisible', 'true')
  })
  await page.reload()
  await page.waitForSelector('.bachi-draw-header', { timeout: 15_000 })

  const cloudPath = path.join(os.tmpdir(), `bachi-e2e-${Date.now()}.bachi`)
  await loadDocument(app, cloudPath, simpleCloud())
  await expect(page.locator('.react-flow')).toBeVisible()

  // Verificamos sobre `.react-flow` los tokens que alimentan el patrón del grid
  // (leer el color de un <pattern> SVG es poco fiable). En oscuro el token de
  // líneas debe ser blanco de baja opacidad, y el default de React Flow ya no
  // debe ser su #eee casi-blanco, sino nuestro token de tema.
  const info = await page
    .locator('.react-flow')
    .first()
    .evaluate((el) => {
      const cs = getComputedStyle(el as Element)
      return {
        theme: document.documentElement.getAttribute('data-theme'),
        gridLine: cs.getPropertyValue('--grid-line').trim(),
        patternDefault: cs.getPropertyValue('--xy-background-pattern-lines-color-default').trim(),
        minimapDefault: cs.getPropertyValue('--xy-minimap-background-color-default').trim()
      }
    })
  expect(info.theme).toBe('dark')
  expect(info.gridLine).toMatch(/rgba?\(255, 255, 255/)
  expect(info.patternDefault).not.toMatch(/eee|238/i)
  // El default del minimapa ya no debe ser el #fff de la librería.
  expect(info.minimapDefault).not.toMatch(/#fff|255, 255, 255/i)

  // El minimapa renderizado tampoco debe tener fondo blanco.
  const minimap = page.locator('.react-flow__minimap')
  await expect(minimap).toBeVisible()
  const minimapBg = await minimap.evaluate((el) => getComputedStyle(el as Element).backgroundColor)
  expect(minimapBg).not.toMatch(/255,\s*255,\s*255/)
})

test('pizarra: oculta figuras, código y fondo/minimapa pero permite guardar', async () => {
  const pizarraPath = path.join(os.tmpdir(), `bachi-e2e-${Date.now()}.dark`)
  await loadDocument(app, pizarraPath, emptyPizarra('Chrome pizarra'))

  await expect(page.locator('.excalidraw')).toBeVisible()
  await expect(page.locator('.bachi-draw-figures')).toHaveCount(0)
  await expect(header(page).getByRole('button', { name: 'Código' })).toHaveCount(0)
  await expect(header(page).getByRole('button', { name: 'Figuras' })).toHaveCount(0)
  await expect(header(page).getByRole('button', { name: 'Minimapa' })).toHaveCount(0)

  // La pizarra sí se guarda (.dark).
  await expect(header(page).getByRole('button', { name: 'Guardar' })).toBeVisible()
})
