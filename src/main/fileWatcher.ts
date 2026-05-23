import chokidar, { FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'
import { readText } from './fileManager'

let activeWatcher: FSWatcher | null = null
let watchedPath: string | null = null

// Ventana temporal durante la cual se ignoran los eventos `change`. La activa
// la propia app al auto-guardar el .bachi desde el editor de código, para que
// la escritura no rebote como si fuera una edición externa (evita el doble
// render y el reencuadre).
let muteUntil = 0

/** Silencia el watcher durante `ms` para no detectar nuestro propio guardado. */
export function muteWatcher(ms = 600): void {
  muteUntil = Date.now() + ms
}

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
    // Cambio provocado por nuestro propio auto-guardado: lo ignoramos.
    if (Date.now() < muteUntil) return
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
