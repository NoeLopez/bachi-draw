import { BrowserWindow, dialog, ipcMain } from 'electron'
import path from 'path'
import { archdPathFor, readJsonIfExists, readText, writeJson, writeText } from './fileManager'
import { muteWatcher, stopWatching, watchArchFile } from './fileWatcher'

export interface OpenedFilePayload {
  path: string
  content: string
  archd: unknown | null
}

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('open-file-dialog', async (): Promise<OpenedFilePayload | null> => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Abrir archivo .bachi',
      filters: [{ name: 'Bachi Draw', extensions: ['bachi'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return loadFile(result.filePaths[0], win)
  })

  ipcMain.handle(
    'open-file-path',
    async (_event, filePath: string): Promise<OpenedFilePayload | null> => {
      const win = getWindow()
      if (!win) return null
      return loadFile(filePath, win)
    }
  )

  ipcMain.handle(
    'save-archd',
    async (_event, payload: { archPath: string; data: unknown }): Promise<{ path: string }> => {
      const archd = archdPathFor(payload.archPath)
      await writeJson(archd, payload.data)
      return { path: archd }
    }
  )

  // Auto-guardado del DSL desde el editor de código. Silencia el watcher antes
  // de escribir para que el cambio no rebote como una edición externa.
  ipcMain.handle(
    'save-bachi',
    async (_event, payload: { path: string; content: string }): Promise<{ path: string }> => {
      muteWatcher()
      await writeText(payload.path, payload.content)
      return { path: payload.path }
    }
  )

  ipcMain.handle('new-diagram', async (): Promise<OpenedFilePayload | null> => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showSaveDialog(win, {
      title: 'Nuevo diagrama',
      defaultPath: 'diagrama.bachi',
      filters: [{ name: 'Bachi Draw', extensions: ['bachi'] }]
    })
    if (result.canceled || !result.filePath) return null
    await writeText(result.filePath, 'arch-cloud lr\n\n')
    return loadFile(result.filePath, win)
  })

  ipcMain.handle('new-board', async (): Promise<OpenedFilePayload | null> => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showSaveDialog(win, {
      title: 'Nueva pizarra',
      defaultPath: 'pizarra.bachi',
      filters: [{ name: 'Bachi Draw', extensions: ['bachi'] }]
    })
    if (result.canceled || !result.filePath) return null
    await writeText(result.filePath, 'arch-cloud lr\n\n')
    return loadFile(result.filePath, win)
  })

  ipcMain.handle('stop-watching', async (): Promise<void> => {
    await stopWatching()
  })

  ipcMain.handle('resolve-arch-name', (_event, filePath: string): string => path.basename(filePath))
}

async function loadFile(filePath: string, win: BrowserWindow): Promise<OpenedFilePayload> {
  const content = await readText(filePath)
  const archd = await readJsonIfExists<unknown>(archdPathFor(filePath))
  await watchArchFile(filePath, win)
  return { path: filePath, content, archd }
}
