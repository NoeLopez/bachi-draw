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

// ── Mejoras: panel redimensionable, línea de error, indicador, autocompletado ──

// Arrastra el tirador de redimensionado `dx` px (re-lee su posición actual).
async function dragResize(p: Page, dx: number): Promise<void> {
  const box = await p.locator('.bachi-draw-code-resize').boundingBox()
  if (!box) throw new Error('no se encontró el tirador de redimensionado')
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await p.mouse.move(cx, cy)
  await p.mouse.down()
  await p.mouse.move(cx + dx, cy, { steps: 10 })
  await p.mouse.up()
}

test('el panel del editor se puede redimensionar arrastrando el borde', async () => {
  await loadDocument(app, bachiPath, CLOUD_DOC)
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  await ensureCodeEditorOpen(page)

  const panel = page.locator('.bachi-draw-code')
  // Encoge al mínimo y luego expande al máximo: robusto ante el ancho persistido.
  await dragResize(page, -1000)
  const min = (await panel.boundingBox())!.width
  await dragResize(page, 1000)
  const max = (await panel.boundingBox())!.width
  expect(max).toBeGreaterThan(min + 200)
})

test('un DSL inválido resalta la línea exacta del error', async () => {
  await loadDocument(app, bachiPath, CLOUD_DOC)
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  await ensureCodeEditorOpen(page)

  // El edge de la línea 6 apunta a un id inexistente.
  await page.locator('.bachi-draw-code-textarea').fill(
    `# c
arch-cloud lr

service web(aws/ec2)[Web]
service db(aws/rds)[DB]
web --> noexiste
`
  )

  // La línea 6 queda marcada en el medianil y como bloque en la capa.
  await expect(page.locator('.bachi-draw-code-lineno.is-error')).toHaveText('6')
  await expect(page.locator('.bachi-draw-code-line.is-error')).toHaveCount(1)
  await expect(page.locator('.bachi-draw-code-error')).toContainText('noexiste')
})

test('el indicador de guardado pasa por "Sin guardar" y vuelve a "Guardado"', async () => {
  await loadDocument(app, bachiPath, CLOUD_DOC)
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  await ensureCodeEditorOpen(page)

  const save = page.locator('.bachi-draw-code-save')
  await expect(save).toContainText('Guardado')

  await page
    .locator('.bachi-draw-code-textarea')
    .fill(CLOUD_DOC.trimEnd() + '\nservice extra(aws/s3)[Extra]')

  // Al escribir, "Sin guardar"; tras el auto-guardado, "Guardado".
  await expect(save).toContainText('Sin guardar')
  await expect(save).toContainText('Guardado', { timeout: 6000 })
})

test('autocompletar: sugiere keywords al inicio de línea y los inserta', async () => {
  await loadDocument(app, bachiPath, CLOUD_DOC)
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  await ensureCodeEditorOpen(page)

  const ta = page.locator('.bachi-draw-code-textarea')
  await ta.fill(CLOUD_DOC + 'serv')

  const suggest = page.locator('.bachi-draw-code-suggest')
  await expect(suggest).toBeVisible()
  await expect(
    suggest.locator('.bachi-draw-code-suggest-item').filter({ hasText: 'service' })
  ).toBeVisible()

  await ta.press('Enter')
  await expect(ta).toHaveValue(/service $/)
})

test('autocompletar: sugiere tipos de icono dentro de paréntesis', async () => {
  await loadDocument(app, bachiPath, CLOUD_DOC)
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  await ensureCodeEditorOpen(page)

  const ta = page.locator('.bachi-draw-code-textarea')
  await ta.fill(CLOUD_DOC + 'service nuevo(aws/ec')

  const suggest = page.locator('.bachi-draw-code-suggest')
  await expect(suggest).toBeVisible()
  await expect(
    suggest.locator('.bachi-draw-code-suggest-item').filter({ hasText: 'aws/ec2' }).first()
  ).toBeVisible()

  await ta.press('Enter')
  await expect(ta).toHaveValue(/\(aws\/ec2/)
})

test('no sugiere en una línea vacía; aparece al escribir la primera letra', async () => {
  await loadDocument(app, bachiPath, CLOUD_DOC)
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  await ensureCodeEditorOpen(page)

  const ta = page.locator('.bachi-draw-code-textarea')
  const suggest = page.locator('.bachi-draw-code-suggest')

  // CLOUD_DOC termina en \n: el caret queda en una línea vacía → sin dropdown.
  await ta.fill(CLOUD_DOC)
  await expect(suggest).toHaveCount(0)

  // Al escribir la primera letra, ahí sí aparece la sugerencia.
  await page.keyboard.type('s')
  await expect(suggest).toBeVisible()
  await expect(
    suggest.locator('.bachi-draw-code-suggest-item').filter({ hasText: 'service' })
  ).toBeVisible()
})

test('autocompletar: sugiere ids existentes como destino de una conexión', async () => {
  await loadDocument(app, bachiPath, CLOUD_DOC)
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  await ensureCodeEditorOpen(page)

  const ta = page.locator('.bachi-draw-code-textarea')
  // Edge nuevo cuyo destino empieza por "d" → debe sugerir el id "db".
  await ta.fill(CLOUD_DOC + 'web --> d')

  const suggest = page.locator('.bachi-draw-code-suggest')
  await expect(suggest).toBeVisible()
  await expect(
    suggest.locator('.bachi-draw-code-suggest-item').filter({ hasText: 'db' })
  ).toBeVisible()

  await ta.press('Enter')
  // El id se completó: la última línea quedó como "web --> db".
  await expect(ta).toHaveValue(/web --> db\s*$/)
})

test('autocompletar tipos: no duplica aliases que resuelven al mismo icono', async () => {
  await loadDocument(app, bachiPath, CLOUD_DOC)
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  await ensureCodeEditorOpen(page)

  const ta = page.locator('.bachi-draw-code-textarea')
  await ta.fill(CLOUD_DOC + 'service x(aws/api')

  const suggest = page.locator('.bachi-draw-code-suggest')
  await expect(suggest).toBeVisible()
  const items = suggest.locator('.bachi-draw-code-suggest-item')
  // Solo aparece la forma corta (sin guion); la forma con guion queda excluida.
  await expect(items.filter({ hasText: /^aws\/apigateway$/ })).toHaveCount(1)
  await expect(items.filter({ hasText: /^aws\/api-gateway$/ })).toHaveCount(0)
})
