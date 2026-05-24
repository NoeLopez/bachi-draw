import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface OpenedFile {
  path: string
  content: string
  archd: unknown | null
}

export interface ArchFileChangedPayload {
  path: string
  content: string
}

export interface ArchFileErrorPayload {
  path: string
  message: string
}

export interface ArchFileRemovedPayload {
  path: string
}

type Disposer = () => void

function on<T>(channel: string, handler: (payload: T) => void): Disposer {
  const listener = (_event: IpcRendererEvent, payload: T): void => handler(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const bachiDraw = {
  newDiagram: (): Promise<OpenedFile | null> => ipcRenderer.invoke('new-diagram'),
  newBoard: (): Promise<OpenedFile | null> => ipcRenderer.invoke('new-board'),
  openFile: (): Promise<OpenedFile | null> => ipcRenderer.invoke('open-file-dialog'),
  openFilePath: (path: string): Promise<OpenedFile | null> =>
    ipcRenderer.invoke('open-file-path', path),
  saveArchd: (archPath: string, data: unknown): Promise<{ path: string }> =>
    ipcRenderer.invoke('save-archd', { archPath, data }),
  saveBachi: (path: string, content: string): Promise<{ path: string }> =>
    ipcRenderer.invoke('save-bachi', { path, content }),
  savePizarra: (filePath: string, data: unknown): Promise<{ path: string }> =>
    ipcRenderer.invoke('save-pizarra', { filePath, data }),
  setNativeTheme: (source: 'system' | 'light' | 'dark'): Promise<void> =>
    ipcRenderer.invoke('set-native-theme', source),
  stopWatching: (): Promise<void> => ipcRenderer.invoke('stop-watching'),
  resolveArchName: (path: string): Promise<string> => ipcRenderer.invoke('resolve-arch-name', path),

  onFileChanged: (handler: (payload: ArchFileChangedPayload) => void): Disposer =>
    on('arch-file-changed', handler),
  onFileError: (handler: (payload: ArchFileErrorPayload) => void): Disposer =>
    on('arch-file-error', handler),
  onFileRemoved: (handler: (payload: ArchFileRemovedPayload) => void): Disposer =>
    on('arch-file-removed', handler)
}

export type BachiDrawApi = typeof bachiDraw

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('bachiDraw', bachiDraw)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (definidos en index.d.ts)
  window.electron = electronAPI
  // @ts-ignore (definidos en index.d.ts)
  window.bachiDraw = bachiDraw
}
