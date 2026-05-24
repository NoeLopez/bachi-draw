import { defineConfig } from '@playwright/test'

// Configuración E2E. Los tests lanzan la app Electron ya compilada (out/) y la
// controlan vía Playwright (_electron). Antes de correr hay que construir:
//   pnpm build   (o usar el script `test:e2e`, que compila primero)
export default defineConfig({
  testDir: './e2e',
  // Los tests de Electron comparten un único proceso de app por archivo; no los
  // paralelizamos para evitar varias ventanas peleando por el foco/diálogos.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    // Carpeta donde se guardan las capturas/trazas de los fallos.
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  }
})
