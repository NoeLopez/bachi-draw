import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { launchApp, loadDocument } from './helpers'

// Grupos con estilo (contenedores AWS tipo Lucid): render con icono/color desde
// el tipo `aws/groups/*`, panel "Grupos" arrastrable y round-trip del tipo al .bachi.
let app: ElectronApplication
let page: Page
let bachiPath: string

const GROUP_DOC = `arch-cloud lr

group vpc(aws/groups/virtual-private-cloud-vpc)[Mi VPC]
service web(aws/ec2)[Web] in vpc
service db(aws/rds)[Base de datos] in vpc
web --> db
`

test.beforeEach(async () => {
  ;({ app, page } = await launchApp())
  bachiPath = path.join(os.tmpdir(), `bachi-grp-${Date.now()}.bachi`)
})

test.afterEach(async () => {
  await app?.close()
  await fs.rm(bachiPath, { force: true })
  await fs.rm(bachiPath.replace(/\.bachi$/, '.bachid'), { force: true })
})

async function save(p: Page): Promise<void> {
  await p.getByRole('button', { name: 'Guardar' }).click()
  await expect(p.locator('.bachi-draw-status-bar')).toContainText('Guardado')
}

test('un grupo con tipo se renderiza con estilo (icono + borde de color)', async () => {
  await loadDocument(app, bachiPath, GROUP_DOC)
  await expect(page.locator('.react-flow__node').first()).toBeVisible()

  // El cluster tipado lleva la clase de estilo y un icono de esquina.
  const styled = page.locator('.bachi-draw-rf-group.is-styled')
  await expect(styled).toHaveCount(1)
  await expect(styled.locator('.bachi-draw-rf-group-icon')).toBeVisible()
})

test('round-trip: guardar conserva el tipo del grupo en el .bachi', async () => {
  await loadDocument(app, bachiPath, GROUP_DOC)
  await expect(page.locator('.react-flow__node').first()).toBeVisible()

  await save(page)

  const saved = await fs.readFile(bachiPath, 'utf-8')
  expect(saved).toContain('group vpc(aws/groups/virtual-private-cloud-vpc)')
})

test('el panel de figuras muestra la sección "Grupos" con los contenedores AWS', async () => {
  await loadDocument(app, bachiPath, GROUP_DOC)
  await expect(page.locator('.bachi-draw-figures')).toBeVisible()

  // La sección "Grupos" aparece en la pestaña AWS (activa por defecto).
  const groupsSection = page
    .locator('.bachi-draw-figures-group')
    .filter({ has: page.locator('.bachi-draw-figures-group-title', { hasText: 'Grupos' }) })
  await expect(groupsSection).toBeVisible()
  // Y contiene items arrastrables del catálogo, ej. "VPC" (acotado a la sección
  // para no chocar con el servicio VPC de la lista de iconos).
  await expect(groupsSection.locator('.bachi-draw-figure[title="VPC"]')).toBeVisible()
})

test('cambiar el tipo de grupo en el inspector actualiza su estilo', async () => {
  await loadDocument(app, bachiPath, GROUP_DOC)
  await expect(page.locator('.react-flow__node').first()).toBeVisible()

  // Selecciona el grupo clicando su cabecera (icono/label) → inspector de grupo.
  await page.locator('.react-flow__node-group').click({ position: { x: 14, y: 18 } })
  const select = page.locator('.bachi-draw-inspector-select')
  await expect(select).toBeVisible()

  // Cambia a "Region" y verifica que persiste al guardar.
  await select.selectOption('aws/groups/region')
  await save(page)
  const saved = await fs.readFile(bachiPath, 'utf-8')
  expect(saved).toContain('group vpc(aws/groups/region)')
})
