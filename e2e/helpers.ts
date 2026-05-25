import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { promises as fs } from 'fs'
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

export interface Point {
  x: number
  y: number
}

/** Forma laxa de un elemento de la escena Excalidraw persistida en el .dark. */
export interface SceneElement {
  type: string
  x: number
  y: number
  width: number
  height: number
  [key: string]: unknown
}

export interface SavedScene {
  kind: string
  elements: SceneElement[]
  appState: Record<string, unknown>
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

/** Contenido de un `.dark` con una figura, para probar apertura/carga real. */
export function darkWithRectangle(name = 'Pizarra abierta'): string {
  return JSON.stringify({
    kind: 'pizarra',
    version: 1,
    name,
    elements: [
      {
        id: 'r1',
        type: 'rectangle',
        x: 200,
        y: 150,
        width: 220,
        height: 120,
        angle: 0,
        strokeColor: '#1e1e1e',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 2,
        strokeStyle: 'solid',
        roughness: 1,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: { type: 3 },
        seed: 1,
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        boundElements: null,
        updated: 1,
        link: null,
        locked: false
      }
    ],
    appState: { scrollX: 0, scrollY: 0, zoom: { value: 1 } },
    files: {}
  })
}

/**
 * `.dark` con un rectángulo de relleno SÓLIDO en (x,y) de tamaño 200×140. El
 * relleno sólido permite agarrarlo por el interior al arrastrar.
 */
export function darkWithSolidRectangle(name = 'config', x = 200, y = 150): string {
  return JSON.stringify({
    kind: 'pizarra',
    version: 1,
    name,
    elements: [
      {
        id: 'r1',
        type: 'rectangle',
        x,
        y,
        width: 200,
        height: 140,
        angle: 0,
        strokeColor: '#1e1e1e',
        backgroundColor: '#a5d8ff',
        fillStyle: 'solid',
        strokeWidth: 2,
        strokeStyle: 'solid',
        roughness: 1,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: { type: 3 },
        seed: 1,
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        boundElements: null,
        updated: 1,
        link: null,
        locked: false
      }
    ],
    appState: { scrollX: 0, scrollY: 0, zoom: { value: 1 } },
    files: {}
  })
}

/** `.dark` con un texto (fontFamily 1 = manuscrita) para probar las fuentes. */
export function darkWithText(text = 'Texto Aa', fontFamily = 1): string {
  return JSON.stringify({
    kind: 'pizarra',
    version: 1,
    name: 'texto',
    elements: [
      {
        id: 't1',
        type: 'text',
        x: 160,
        y: 160,
        width: 360,
        height: 50,
        angle: 0,
        strokeColor: '#1e1e1e',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 1,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: 1,
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        boundElements: null,
        updated: 1,
        link: null,
        locked: false,
        text,
        fontSize: 28,
        fontFamily,
        textAlign: 'left',
        verticalAlign: 'top',
        containerId: null,
        originalText: text,
        lineHeight: 1.25
      }
    ],
    appState: { scrollX: 0, scrollY: 0, zoom: { value: 1 } },
    files: {}
  })
}

/**
 * Sustituye el diálogo nativo "abrir archivo" del proceso main para que devuelva
 * `filePath`, de modo que pulsar "Abrir" cargue ese archivo sin diálogo.
 */
export async function mockOpenDialog(app: ElectronApplication, filePath: string): Promise<void> {
  await app.evaluate(({ dialog }, p) => {
    ;(dialog as unknown as { showOpenDialog: () => Promise<unknown> }).showOpenDialog =
      async () => ({
        canceled: false,
        filePaths: [p]
      })
  }, filePath)
}

/** DSL mínimo de un diagrama cloud (.bachi): dos servicios y una arista. */
export function simpleCloud(): string {
  return [
    'arch-cloud lr',
    '',
    'service api(oss/server)[API]',
    'service db(oss/postgres)[DB]',
    '',
    'api --> db',
    ''
  ].join('\n')
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

/**
 * Carga una pizarra vacía y espera a que Excalidraw esté montado e interactivo.
 * Esperar a que la barra de herramientas sea visible (y un breve margen) evita
 * que la primera interacción se pierda mientras Excalidraw aún inicializa.
 */
export async function loadEmptyPizarra(
  app: ElectronApplication,
  page: Page,
  filePath: string
): Promise<void> {
  await loadDocument(app, filePath, emptyPizarra())
  await page.waitForSelector('.excalidraw', { timeout: 10_000 })
  await page.waitForSelector('[data-testid="toolbar-rectangle"]', {
    state: 'visible',
    timeout: 10_000
  })
  await page.waitForTimeout(350)
}

/** Bounding box del canvas principal de Excalidraw. */
export async function excalidrawCanvasBox(
  page: Page
): Promise<{ x: number; y: number; width: number; height: number }> {
  const canvas = page.locator('.excalidraw canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('No se encontró el canvas de Excalidraw')
  return box
}

/** Punto en el canvas a partir de fracciones (0..1) de su ancho/alto. */
export async function canvasPoint(page: Page, fx: number, fy: number): Promise<Point> {
  const box = await excalidrawCanvasBox(page)
  return { x: box.x + box.width * fx, y: box.y + box.height * fy }
}

/** Herramientas de la barra de Excalidraw usadas como utilería de los tests. */
export type ExcalidrawTool = 'selection' | 'rectangle' | 'ellipse' | 'diamond'

/**
 * Selecciona una herramienta de la barra de Excalidraw por su data-testid.
 * El testid está en el `<input type="radio">`, cubierto por el icono SVG (que
 * intercepta el puntero), así que forzamos el click sobre el input.
 */
export async function selectTool(page: Page, tool: ExcalidrawTool): Promise<void> {
  await page.locator(`[data-testid="toolbar-${tool}"]`).click({ force: true })
}

/** Dibuja una figura arrastrando (utilería para preparar el estado del test). */
export async function drawWithTool(
  page: Page,
  tool: ExcalidrawTool,
  origin: Point,
  size: { w: number; h: number }
): Promise<void> {
  await selectTool(page, tool)
  await page.mouse.move(origin.x, origin.y)
  await page.mouse.down()
  await page.mouse.move(origin.x + size.w, origin.y + size.h, { steps: 10 })
  await page.mouse.up()
}

/** Atajo: dibuja un rectángulo. */
export async function drawRectangle(
  page: Page,
  origin: Point,
  size: { w: number; h: number }
): Promise<void> {
  await drawWithTool(page, 'rectangle', origin, size)
}

/** Arrastra desde `from` hasta `to` (mover una figura/selección). */
export async function dragMouse(page: Page, from: Point, to: Point): Promise<void> {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 12 })
  await page.mouse.up()
}

/**
 * Pulsa "Guardar" en la toolbar de Bachi Draw, espera a que se escriba el .dark
 * y devuelve la escena parseada del disco. Validación de extremo a extremo: lo
 * que está en el lienzo acabó realmente en el archivo del proyecto.
 */
export async function saveAndReadScene(page: Page, filePath: string): Promise<SavedScene> {
  await page.getByRole('button', { name: 'Guardar' }).click()
  // El guardado escribe el archivo antes de actualizar el estado; un pequeño
  // margen asegura que el IPC terminó de escribir a disco.
  await page.waitForTimeout(500)
  return JSON.parse(await fs.readFile(filePath, 'utf-8'))
}
