import { ElectronAPI } from '@electron-toolkit/preload'
import type { DiagenApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    diagen: DiagenApi
  }
}
