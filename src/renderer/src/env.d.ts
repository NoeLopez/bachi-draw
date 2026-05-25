/// <reference types="vite/client" />

interface Window {
  /** Ruta base desde la que Excalidraw carga sus fuentes/assets. La fijamos al
   * directorio del index.html para servirlas localmente, sin CDN (ver
   * setupExcalidrawAssets.ts). */
  EXCALIDRAW_ASSET_PATH?: string | string[]
}
