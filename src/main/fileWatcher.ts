import chokidar, { FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'
import { readText } from './fileManager'

let activeWatcher: FSWatcher | null = null
let watchedPath: string | null = null

export function watchedFile(): string | null {
  return watchedPath
}

export async function stopWatching(): Promise<void> {
  if (activeWatcher) {
    await activeWatcher.close()
    activeWatcher = null
    watchedPath = null
  }
}

export async function watchArchFile(filePath: string, win: BrowserWindow): Promise<void> {
  await stopWatching()

  const watcher = chokidar.watch(filePath, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50
    }
  })

  watcher.on('change', async (changedPath) => {
    try {
      const content = await readText(changedPath)
      if (!win.isDestroyed()) {
        win.webContents.send('arch-file-changed', { path: changedPath, content })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!win.isDestroyed()) {
        win.webContents.send('arch-file-error', { path: changedPath, message })
      }
    }
  })

  watcher.on('unlink', (removedPath) => {
    if (!win.isDestroyed()) {
      win.webContents.send('arch-file-removed', { path: removedPath })
    }
  })

  activeWatcher = watcher
  watchedPath = filePath
}
