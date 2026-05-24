import { BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron'
import path from 'path'
import { archdPathFor, readJsonIfExists, readText, writeJson, writeText } from './fileManager'
import { muteWatcher, stopWatching, watchArchFile } from './fileWatcher'

export interface OpenedFilePayload {
  path: string
  content: string
  archd: unknown | null
}

// Escena Excalidraw vacía para una pizarra nueva (formato .dark).
const EMPTY_PIZARRA = {
  kind: 'pizarra',
  version: 1,
  name: '',
  elements: [],
  appState: {},
  files: {}
}

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  // Sincroniza la apariencia NATIVA de la ventana con el tema de la app. macOS
  // dibuja los semáforos (cerrar/min/max) según esta apariencia; si no coincide
  // con nuestro header, quedan sin contraste (invisibles). 'system' deja que siga
  // al SO (cuando el usuario no ha forzado tema).
  ipcMain.handle('set-native-theme', (_event, source: 'system' | 'light' | 'dark'): void => {
    nativeTheme.themeSource = source
  })

  // Pantalla completa "simple" (sin crear un espacio nativo de macOS) para el
  // modo presentación. Best-effort: si no hay ventana, no hace nada.
  ipcMain.handle('enter-presentation', (): void => {
    getWindow()?.setSimpleFullScreen(true)
  })
  ipcMain.handle('exit-presentation', (): void => {
    getWindow()?.setSimpleFullScreen(false)
  })

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

  // Crea una pizarra Excalidraw nueva: escribe un .dark vacío y lo carga.
  ipcMain.handle('new-board', async (): Promise<OpenedFilePayload | null> => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showSaveDialog(win, {
      title: 'Nueva pizarra',
      defaultPath: 'nueva-pizarra.dark',
      filters: [{ name: 'Pizarra', extensions: ['dark'] }]
    })
    if (result.canceled || !result.filePath) return null
    await writeJson(result.filePath, EMPTY_PIZARRA)
    return loadFile(result.filePath, win)
  })

  // Guarda el estado actual de la pizarra directamente en el archivo .dark.
  ipcMain.handle(
    'save-pizarra',
    async (_event, payload: { filePath: string; data: unknown }): Promise<{ path: string }> => {
      await writeJson(payload.filePath, payload.data)
      return { path: payload.filePath }
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
