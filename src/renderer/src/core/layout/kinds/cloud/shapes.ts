// Figuras geométricas básicas. Los SVG viven en icons/oss/shapes/ y son
// descubiertos por el glob de officialIcons igual que cualquier otro icono.
// El tipo lógico conserva el path completo: "oss/shapes/rectangle", etc.

export type ShapeType = 'rectangle' | 'rounded-rect' | 'circle' | 'diamond' | 'arrow' | 'textbox'

/** Prefijo de tipo que identifica un nodo figura (oss/shapes/<nombre>). */
export const SHAPE_PREFIX = 'oss/shapes/'

export const SHAPE_LABEL: Record<ShapeType, string> = {
  rectangle: 'Rectángulo',
  'rounded-rect': 'Redondeado',
  circle: 'Círculo',
  diamond: 'Rombo',
  arrow: 'Flecha',
  textbox: 'Texto'
}

export const ALL_SHAPES: ShapeType[] = [
  'rectangle',
  'rounded-rect',
  'circle',
  'diamond',
  'arrow',
  'textbox'
]

export function toShapeNodeType(shape: ShapeType): string {
  return `${SHAPE_PREFIX}${shape}`
}

export function fromShapeNodeType(nodeType: string): ShapeType | null {
  if (!nodeType.startsWith(SHAPE_PREFIX)) return null
  return nodeType.slice(SHAPE_PREFIX.length) as ShapeType
}

/** Dimensiones por defecto al soltar una figura nueva en el lienzo. */
export function defaultShapeSize(shape: ShapeType): { width: number; height: number } {
  if (shape === 'circle' || shape === 'diamond') return { width: 100, height: 100 }
  return { width: 160, height: 80 }
}
