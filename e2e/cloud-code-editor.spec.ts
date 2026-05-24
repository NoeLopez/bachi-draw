import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import os from 'os'
import path from 'path'
import { launchApp, loadDocument } from './helpers'

// Cada test arranca una app Electron fresca. Nota: localStorage (preferencia de
// visibilidad del editor) SÍ persiste entre lanzamientos al compartir userData,
// por eso `ensureCodeEditorOpen` es tolerante al estado inicial.
let app: ElectronApplication
let page: Page
let bachiPath: string

const CLOUD_DOC = `# diagrama de prueba
arch-cloud lr

service web(aws/ec2)[Servidor web]
service db(aws/rds)[Base de datos]
web --> db
`

const CLOUD_DOC_3 = `# diagrama de prueba
arch-cloud lr

service web(aws/ec2)[Servidor web]
service db(aws/rds)[Base de datos]
service cache(aws/elasticache)[Cache]
web --> db
web --> cache
`

test.beforeEach(async () => {
  ;({ app, page } = await launchApp())
  bachiPath = path.join(os.tmpdir(), `bachi-e2e-${Date.now()}.bachi`)
})

test.afterEach(async () => {
  await app?.close()
})

// Abre el editor de código si no lo está ya (tolera el estado persistido).
async function ensureCodeEditorOpen(p: Page): Promise<void> {
  const editor = p.locator('.bachi-draw-code')
  if ((await editor.count()) === 0) {
    await p.getByRole('button', { name: 'Código' }).click()
  }
  await expect(editor).toBeVisible()
}

test('el editor de código muestra el DSL del diagrama cargado', async () => {
  await loadDocument(app, bachiPath, CLOUD_DOC)
  await expect(page.locator('.react-flow__node')).toHaveCount(2)

  await ensureCodeEditorOpen(page)
  await expect(page.locator('.bachi-draw-code-textarea')).toHaveValue(CLOUD_DOC)
})

test('el resaltado colorea keywords, flechas, tipos, labels y comentarios', async () => {
  await loadDocument(app, bachiPath, CLOUD_DOC)
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  await ensureCodeEditorOpen(page)

  const hl = page.locator('.bachi-draw-code-highlight')
  // Keyword del header y de cada declaración service.
  await expect(hl.locator('.bachi-tok-keyword').filter({ hasText: 'arch-cloud' })).toHaveCount(1)
  await expect(hl.locator('.bachi-tok-keyword').filter({ hasText: 'service' })).toHaveCount(2)
  // Flecha de la conexión.
  await expect(hl.locator('.bachi-tok-arrow')).toHaveCount(1)
  await expect(hl.locator('.bachi-tok-arrow').first()).toHaveText('-->')
  // Comentario de la primera línea.
  await expect(hl.locator('.bachi-tok-comment').first()).toContainText('diagrama de prueba')
  // Tipo de icono (dentro de paréntesis) y label (entre corchetes).
  await expect(hl.locator('.bachi-tok-type').filter({ hasText: 'aws/ec2' })).toHaveCount(1)
  await expect(hl.locator('.bachi-tok-label').filter({ hasText: 'Servidor web' })).toHaveCount(1)
})

test('escribir en el editor redibuja el diagrama y reactualiza el resaltado', async () => {
  await loadDocument(app, bachiPath, CLOUD_DOC)
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  await ensureCodeEditorOpen(page)

  // Reemplaza el DSL por uno con un tercer servicio y una segunda conexión.
  await page.locator('.bachi-draw-code-textarea').fill(CLOUD_DOC_3)

  // Preview en vivo: el tercer nodo aparece tras el debounce + layout de ELK.
  await expect(page.locator('.react-flow__node')).toHaveCount(3)

  // El resaltado se recalcula con el nuevo contenido.
  const hl = page.locator('.bachi-draw-code-highlight')
  await expect(hl.locator('.bachi-tok-type').filter({ hasText: 'aws/elasticache' })).toHaveCount(1)
  await expect(hl.locator('.bachi-tok-keyword').filter({ hasText: 'service' })).toHaveCount(3)
  await expect(hl.locator('.bachi-tok-arrow')).toHaveCount(2)
})

test('el contenido editado se mantiene exacto en el textarea (alineación overlay)', async () => {
  await loadDocument(app, bachiPath, CLOUD_DOC)
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  await ensureCodeEditorOpen(page)

  await page.locator('.bachi-draw-code-textarea').fill(CLOUD_DOC_3)
  // El textarea (capa editable) conserva el texto íntegro: la capa de resaltado
  // es puramente visual y no altera el valor.
  await expect(page.locator('.bachi-draw-code-textarea')).toHaveValue(CLOUD_DOC_3)
})
