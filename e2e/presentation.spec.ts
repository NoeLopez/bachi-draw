import { test, expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import os from 'os'
import path from 'path'
import { launchApp, loadDocument, simpleCloud } from './helpers'

// El modo presentación oculta todo el chrome de edición y deja el lienzo limpio.
// Se entra con el botón "Presentar" o F5, y se sale con Esc o el hint clicable.

let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  ;({ app, page } = await launchApp())
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForSelector('.bachi-draw-header', { timeout: 15_000 })
})

test.afterEach(async () => {
  await app?.close()
})

function header(p: Page): Locator {
  return p.locator('.bachi-draw-header')
}

async function loadCloud(): Promise<void> {
  const cloudPath = path.join(os.tmpdir(), `bachi-e2e-${Date.now()}.bachi`)
  await loadDocument(app, cloudPath, simpleCloud())
  await expect(page.locator('.react-flow')).toBeVisible()
}

test('el botón Presentar solo aparece con un documento cargado', async () => {
  // Sin documento (bienvenida): no hay botón Presentar.
  await expect(page.locator('.bachi-draw-empty-state')).toBeVisible()
  await expect(header(page).getByRole('button', { name: 'Presentar' })).toHaveCount(0)

  // Con un diagrama cargado, el botón aparece.
  await loadCloud()
  await expect(header(page).getByRole('button', { name: 'Presentar' })).toBeVisible()
})

test('al presentar se oculta todo el chrome y aparece el hint de salida', async () => {
  await loadCloud()
  await header(page).getByRole('button', { name: 'Presentar' }).click()

  // La app marca el modo y el chrome de edición desaparece.
  await expect(page.locator('.bachi-draw-app.is-presenting')).toBeVisible()
  await expect(page.locator('.bachi-draw-header')).toHaveCount(0)
  await expect(page.locator('.bachi-draw-figures')).toHaveCount(0)
  await expect(page.locator('.bachi-draw-status-bar')).toHaveCount(0)

  // El lienzo sigue ahí y aparece el hint de salida.
  await expect(page.locator('.react-flow')).toBeVisible()
  await expect(page.locator('.bachi-draw-presentation-hint')).toBeVisible()
})

test('Escape sale del modo presentación y restaura el chrome', async () => {
  await loadCloud()
  await header(page).getByRole('button', { name: 'Presentar' }).click()
  await expect(page.locator('.bachi-draw-app.is-presenting')).toBeVisible()

  await page.keyboard.press('Escape')

  await expect(page.locator('.bachi-draw-app.is-presenting')).toHaveCount(0)
  await expect(page.locator('.bachi-draw-header')).toBeVisible()
  await expect(page.locator('.bachi-draw-presentation-hint')).toHaveCount(0)
})

test('F5 entra en modo presentación con un documento cargado', async () => {
  await loadCloud()
  await page.keyboard.press('F5')

  await expect(page.locator('.bachi-draw-app.is-presenting')).toBeVisible()
  await expect(page.locator('.bachi-draw-header')).toHaveCount(0)
})

test('el hint de salida cierra la presentación al hacer clic', async () => {
  await loadCloud()
  await header(page).getByRole('button', { name: 'Presentar' }).click()
  await expect(page.locator('.bachi-draw-presentation-hint')).toBeVisible()

  await page.locator('.bachi-draw-presentation-hint').click()

  await expect(page.locator('.bachi-draw-app.is-presenting')).toHaveCount(0)
  await expect(page.locator('.bachi-draw-header')).toBeVisible()
})
