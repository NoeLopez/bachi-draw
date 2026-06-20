import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { launchApp, loadDocument } from './helpers'

// Verifica el loop IA ↔ humano: las ediciones visuales se escriben de vuelta al
// .bachi (serializeCloud conectado al guardado).
let app: ElectronApplication
let page: Page
let bachiPath: string

const SMALL_DOC = `arch-cloud lr

service web(aws/ec2)[Servidor web]
service db(aws/rds)[Base de datos]
web --> db
`

test.beforeEach(async () => {
  ;({ app, page } = await launchApp())
  bachiPath = path.join(os.tmpdir(), `bachi-rt-${Date.now()}.bachi`)
})

test.afterEach(async () => {
  await app?.close()
  await fs.rm(bachiPath, { force: true })
  await fs.rm(bachiPath.replace(/\.bachi$/, '.bachid'), { force: true })
})

// Extrae el número de una estadística del StatusBar (ej. "71 nodos").
async function statCount(p: Page, label: string): Promise<number> {
  const text = await p.locator('.bachi-draw-status-meta').innerText()
  const m = text.match(new RegExp(`(\\d+)\\s+${label}`))
  return m ? Number(m[1]) : -1
}

async function save(p: Page): Promise<void> {
  await p.getByRole('button', { name: 'Guardar' }).click()
  await expect(p.locator('.bachi-draw-status-bar')).toContainText('Guardado')
}

test('round-trip: guardar reescribe el .bachi conservando nodos, edges y clusters', async () => {
  const enterprise = await fs.readFile(
    path.resolve(__dirname, '../resources/enterprise-saas.bachi'),
    'utf-8'
  )
  await loadDocument(app, bachiPath, enterprise)
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
  await expect(page.locator('.bachi-draw-status-meta')).toContainText('nodos')

  const nodes = await statCount(page, 'nodos')
  const edges = await statCount(page, 'edges')
  const clusters = await statCount(page, 'clusters')
  expect(nodes).toBeGreaterThan(0)

  await save(page)

  const saved = await fs.readFile(bachiPath, 'utf-8')
  expect(saved.startsWith('# arch-cloud')).toBeTruthy()
  expect((saved.match(/^service /gm) ?? []).length).toBe(nodes)
  expect((saved.match(/^group /gm) ?? []).length).toBe(clusters)
  expect((saved.match(/^\S+\s+(?:-->|-\.->|<-->)\s+\S+/gm) ?? []).length).toBe(edges)
})

test('renombrar un nodo y guardar escribe el nuevo label en el .bachi', async () => {
  await loadDocument(app, bachiPath, SMALL_DOC)
  await expect(page.locator('.react-flow__node')).toHaveCount(2)

  // Doble click en el label del nodo "web" → editor inline.
  const webNode = page.locator('.react-flow__node', { hasText: 'Servidor web' })
  await webNode.locator('.bachi-draw-rf-label').dblclick()
  const input = page.locator('.bachi-draw-rf-label-input')
  await expect(input).toBeVisible()
  await input.fill('Frontend')
  await input.press('Enter')

  await save(page)

  const saved = await fs.readFile(bachiPath, 'utf-8')
  expect(saved).toContain('[Frontend]')
  expect(saved).not.toContain('[Servidor web]')
})

test('borrar un nodo y guardar lo elimina del .bachi (sin nodos fantasma)', async () => {
  await loadDocument(app, bachiPath, SMALL_DOC)
  await expect(page.locator('.react-flow__node')).toHaveCount(2)

  // Selecciona el nodo "db" (clic en su label) y bórralo con Backspace.
  const dbNode = page.locator('.react-flow__node', { hasText: 'Base de datos' })
  await dbNode.locator('.bachi-draw-rf-label').click()
  await page.keyboard.press('Backspace')
  await expect(page.locator('.react-flow__node')).toHaveCount(1)

  await save(page)

  const saved = await fs.readFile(bachiPath, 'utf-8')
  expect(saved).toContain('service web')
  expect(saved).not.toContain('service db')
  // El edge hacia el nodo borrado tampoco debe quedar.
  expect(saved).not.toContain('--> db')
})

test('un label multilínea se escapa como \\n en el .bachi', async () => {
  await loadDocument(app, bachiPath, SMALL_DOC)
  await expect(page.locator('.react-flow__node')).toHaveCount(2)

  const webNode = page.locator('.react-flow__node', { hasText: 'Servidor web' })
  await webNode.locator('.bachi-draw-rf-label').dblclick()
  const input = page.locator('.bachi-draw-rf-label-input')
  await expect(input).toBeVisible()
  // Reemplaza el contenido (viene seleccionado) por dos líneas.
  await page.keyboard.type('Linea1')
  await page.keyboard.press('Shift+Enter')
  await page.keyboard.type('Linea2')
  await page.keyboard.press('Enter')

  await save(page)

  const saved = await fs.readFile(bachiPath, 'utf-8')
  // El salto de línea va escapado como \n literal dentro del bracket.
  expect(saved).toContain('[Linea1\\nLinea2]')
})

test('un .bachi con \\n en un label se carga como label multilínea', async () => {
  // El archivo contiene la secuencia escapada \n (dos caracteres) dentro del
  // bracket; el parser la desescapa a un salto de línea real.
  const doc = 'arch-cloud lr\n\nservice web(aws/ec2)[Arriba\\nAbajo]\n'
  await loadDocument(app, bachiPath, doc)
  const webNode = page.locator('.react-flow__node').first()
  await expect(webNode).toBeVisible()
  await expect(webNode).toContainText('Arriba')
  await expect(webNode).toContainText('Abajo')
})

test('el indicador ● aparece al editar y desaparece al guardar', async () => {
  await loadDocument(app, bachiPath, SMALL_DOC)
  await expect(page.locator('.react-flow__node')).toHaveCount(2)

  const dirty = page.locator('.bachi-draw-status-dirty')
  await expect(dirty).toHaveCount(0)

  // Una edición (renombrar) marca cambios sin guardar.
  const webNode = page.locator('.react-flow__node', { hasText: 'Servidor web' })
  await webNode.locator('.bachi-draw-rf-label').dblclick()
  const input = page.locator('.bachi-draw-rf-label-input')
  await input.fill('Web')
  await input.press('Enter')
  await expect(dirty).toBeVisible()

  await save(page)
  await expect(dirty).toHaveCount(0)
})
