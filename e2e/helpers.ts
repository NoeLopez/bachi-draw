import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'path'

// Playwright transpila los tests a CommonJS (el proyecto no es "type":"module"),
// así que usamos __dirname en vez de import.meta.url.
const APP_DIR = path.resolve(__dirname, '..')

// Binario de Electron según plataforma.
const ELECTRON_BIN =
  process.platform === 'darwin'
    ? path.join(APP_DIR, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
    : path.join(APP_DIR, 'node_modules/electron/dist/electron')

export interface LaunchedApp {
  app: ElectronApplication
  page: Page
}

/**
 * Lanza la app Electron ya compilada (out/main/index.js) y devuelve la app y la
 * página del renderer lista para interactuar. Requiere `pnpm build` previo.
 */
export async function launchApp(): Promise<LaunchedApp> {
  const app = await electron.launch({
    executablePath: ELECTRON_BIN,
    args: [
      path.join(APP_DIR, 'out/main/index.js'),
      ...(process.platform === 'linux' ? ['--no-sandbox'] : [])
    ],
    timeout: 30_000
  })
  const page = await app.firstWindow()
  // Espera a que el renderer monte el header (señal de app lista).
  await page.waitForSelector('.bachi-draw-header', { timeout: 15_000 })
  return { app, page }
}

/**
 * Carga un documento en el editor sin pasar por el diálogo nativo de archivos.
 * Emula lo que hace el file watcher: envía el evento IPC `arch-file-changed`
 * desde el proceso main con el contenido dado, igual que un hot reload.
 */
export async function loadDocument(
  app: ElectronApplication,
  filePath: string,
  content: string
): Promise<void> {
  await app.evaluate(
    ({ BrowserWindow }, args) => {
      const win = BrowserWindow.getAllWindows()[0]
      win.webContents.send('arch-file-changed', { path: args.filePath, content: args.content })
    },
    { filePath, content }
  )
}

/** Contenido de una pizarra vacía con el formato `.dark`. */
export function emptyPizarra(name = 'E2E pizarra'): string {
  return JSON.stringify({
    kind: 'pizarra',
    version: 1,
    name,
    elements: [],
    appState: { scrollX: 0, scrollY: 0, zoom: { value: 1 } },
    files: {}
  })
}

/** Selecciona una herramienta del panel de Excalidraw por su atributo title. */
export async function selectExcalidrawTool(page: Page, pattern: RegExp): Promise<boolean> {
  return page.evaluate(
    (src) => {
      const re = new RegExp(src.source, src.flags)
      const tools = [...document.querySelectorAll('.excalidraw [title]')]
      const tool = tools.find((t) => re.test(t.getAttribute('title') || ''))
      if (tool) {
        ;(tool as HTMLElement).click()
        return true
      }
      return false
    },
    { source: pattern.source, flags: pattern.flags }
  )
}

/** Dibuja un rectángulo arrastrando dentro del canvas de Excalidraw. */
export async function drawRectangle(
  page: Page,
  origin: { x: number; y: number },
  size: { w: number; h: number }
): Promise<void> {
  await selectExcalidrawTool(page, /rect|rectángulo/i)
  await page.mouse.move(origin.x, origin.y)
  await page.mouse.down()
  await page.mouse.move(origin.x + size.w, origin.y + size.h, { steps: 10 })
  await page.mouse.up()
}

/** Devuelve el bounding box del canvas principal de Excalidraw. */
export async function excalidrawCanvasBox(
  page: Page
): Promise<{ x: number; y: number; width: number; height: number }> {
  const canvas = page.locator('.excalidraw canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('No se encontró el canvas de Excalidraw')
  return box
}
