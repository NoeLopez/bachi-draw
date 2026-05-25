import { resolve } from 'path'
import { cpSync, realpathSync } from 'fs'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Excalidraw carga sus fuentes en runtime desde una ruta base. Por defecto usa
// un CDN (esm.sh), bloqueado en esta app (Electron, offline + CSP 'self'). Las
// copiamos a la carpeta `public/fonts` del renderer: Vite las sirve en dev y las
// emite junto al index.html en el build, quedando en `<out>/fonts`. En
// setupExcalidrawAssets.ts apuntamos EXCALIDRAW_ASSET_PATH al directorio del
// index.html, así Excalidraw las resuelve en `fonts/...` localmente.
function copyExcalidrawFonts(): Plugin {
  return {
    name: 'copy-excalidraw-fonts',
    buildStart() {
      // realpathSync dereferencia el symlink de pnpm (.pnpm) al directorio físico.
      const src = realpathSync(resolve('node_modules/@excalidraw/excalidraw/dist/prod/fonts'))
      // Excluimos Xiaolai (CJK, ~12MB): Excalidraw lo pide siempre a su CDN de
      // subsetting (ignora EXCALIDRAW_ASSET_PATH), así que copiarlo no sirve.
      cpSync(src, resolve('src/renderer/public/fonts'), {
        recursive: true,
        filter: (s) => !s.includes('Xiaolai')
      })
    }
  }
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react(), copyExcalidrawFonts()]
  }
})
