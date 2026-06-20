import { test, expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import os from 'os'
import path from 'path'
import { launchApp, loadDocument, simpleCloud } from './helpers'

// Panel de referencia de atajos: se abre con el botón de la toolbar o con "?",
// y se cierra con Esc, la ✕ o un clic en el overlay. Además, "?" no debe abrirlo
// mientras se escribe en un campo de texto.

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

test('el botón de la toolbar abre el panel de atajos', async () => {
  await header(page).getByRole('button', { name: 'Atajos de teclado' }).click()

  const modal = page.locator('.bachi-draw-shortcuts-modal')
  await expect(modal).toBeVisible()
  await expect(modal).toContainText('Atajos de teclado')
  // Lista atajos reales conocidos.
  await expect(modal).toContainText('Guardar posiciones')
  await expect(modal).toContainText('Eliminar lo seleccionado')
  await expect(modal).toContainText('modo presentación')
})

test('la tecla ? abre el panel y Escape lo cierra', async () => {
  await page.keyboard.press('Shift+Slash') // "?"
  await expect(page.locator('.bachi-draw-shortcuts-modal')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.locator('.bachi-draw-shortcuts-modal')).toHaveCount(0)
})

test('la ✕ y el clic en el overlay cierran el panel', async () => {
  // Cerrar con la ✕.
  await header(page).getByRole('button', { name: 'Atajos de teclado' }).click()
  await expect(page.locator('.bachi-draw-shortcuts-modal')).toBeVisible()
  await page.locator('.bachi-draw-shortcuts-close').click()
  await expect(page.locator('.bachi-draw-shortcuts-modal')).toHaveCount(0)

  // Cerrar con clic en el overlay (en una esquina, fuera de la tarjeta).
  await header(page).getByRole('button', { name: 'Atajos de teclado' }).click()
  await expect(page.locator('.bachi-draw-shortcuts-modal')).toBeVisible()
  await page.locator('.bachi-draw-shortcuts-overlay').click({ position: { x: 8, y: 8 } })
  await expect(page.locator('.bachi-draw-shortcuts-modal')).toHaveCount(0)
})

test('la tecla ? no abre el panel mientras se escribe en el editor de código', async () => {
  await loadCloud()
  await header(page).getByRole('button', { name: 'Código' }).click()
  const textarea = page.locator('.bachi-draw-code-textarea')
  await expect(textarea).toBeVisible()
  await textarea.click()

  await page.keyboard.press('Shift+Slash') // "?" — debe ir al textarea, no abrir el panel

  await expect(page.locator('.bachi-draw-shortcuts-modal')).toHaveCount(0)
})

test('Cmd/Ctrl+S guarda las posiciones (.bachid)', async () => {
  await loadCloud()
  await page.keyboard.press('ControlOrMeta+s')
  await expect(page.locator('.bachi-draw-status-bar')).toContainText('Guardado')
})
