import { BrowserWindow, dialog, ipcMain } from 'electron'
import path from 'path'
import { archdPathFor, readJsonIfExists, readText, writeJson } from './fileManager'
import { stopWatching, watchArchFile } from './fileWatcher'

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
      title: 'Abrir archivo .arch',
      filters: [{ name: 'Diagen', extensions: ['arch'] }],
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
