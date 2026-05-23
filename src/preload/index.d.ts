import { ElectronAPI } from '@electron-toolkit/preload'
import type { BachiDrawApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    bachiDraw: BachiDrawApi
  }
}
