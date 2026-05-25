// IMPORTANTE: este módulo debe importarse ANTES que Excalidraw.
//
// Excalidraw resuelve la URL de sus fuentes contra `window.EXCALIDRAW_ASSET_PATH`
// y, si no se define, cae a un CDN (esm.sh). En esta app (Electron, sin red +
// CSP 'self') ese CDN está bloqueado, así que las fuentes no cargan y el texto
// usa una tipografía de respaldo del sistema.
//
// Las fuentes se copian junto al index.html (carpeta `fonts/`, ver
// electron.vite.config.ts). Apuntamos la ruta base al directorio del documento:
// `new URL('.', location.href)` resuelve bien tanto en dev (http://localhost) como
// en producción (file://). OJO: no sirve usar '/' o './' porque en file:// el
// origin es "file://" y resolvería a la raíz del disco (file:///).
if (typeof window !== 'undefined') {
  window.EXCALIDRAW_ASSET_PATH = new URL('.', window.location.href).href
}
