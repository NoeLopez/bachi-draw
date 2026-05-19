export interface ViewportState {
  zoom: number
  offsetX: number
  offsetY: number
}

export const DEFAULT_VIEWPORT: ViewportState = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0
}

export const MIN_ZOOM = 0.2
export const MAX_ZOOM = 4

export function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
}

/**
 * Calcula el nuevo viewport tras hacer zoom alrededor de un punto del SVG
 * (en coordenadas del contenedor). Mantiene el punto bajo el cursor estable.
 */
export function zoomAtPoint(
  viewport: ViewportState,
  factor: number,
  pointerX: number,
  pointerY: number
): ViewportState {
  const newZoom = clampZoom(viewport.zoom * factor)
  if (newZoom === viewport.zoom) return viewport
  const k = newZoom / viewport.zoom
  return {
    zoom: newZoom,
    offsetX: pointerX - (pointerX - viewport.offsetX) * k,
    offsetY: pointerY - (pointerY - viewport.offsetY) * k
  }
}

export function pan(viewport: ViewportState, dx: number, dy: number): ViewportState {
  return {
    zoom: viewport.zoom,
    offsetX: viewport.offsetX + dx,
    offsetY: viewport.offsetY + dy
  }
}

/**
 * Encuadra la vista para que el contenido (width × height) quepa centrado
 * dentro de un contenedor del tamaño dado, con un padding configurable.
 */
export function fitToContainer(
  contentWidth: number,
  contentHeight: number,
  containerWidth: number,
  containerHeight: number,
  padding = 40
): ViewportState {
  if (contentWidth <= 0 || contentHeight <= 0) return DEFAULT_VIEWPORT
  const availW = Math.max(1, containerWidth - padding * 2)
  const availH = Math.max(1, containerHeight - padding * 2)
  const zoom = clampZoom(Math.min(availW / contentWidth, availH / contentHeight, 1))
  const offsetX = (containerWidth - contentWidth * zoom) / 2
  const offsetY = (containerHeight - contentHeight * zoom) / 2
  return { zoom, offsetX, offsetY }
}
