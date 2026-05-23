import { useStore } from '@xyflow/react'
import type { GuideLine } from '../../../core/layout/kinds/cloud/alignment'

/**
 * Dibuja las líneas guía de alineación (estilo Lucid) mientras se arrastra un
 * nodo. Las posiciones de las guías vienen en coordenadas absolutas del lienzo;
 * aquí las transformamos a píxeles de pantalla usando la transform del viewport
 * de React Flow ([translateX, translateY, zoom]).
 */
export default function AlignmentGuides({
  guides
}: {
  guides: GuideLine[]
}): React.JSX.Element | null {
  const [tx, ty, zoom] = useStore((s) => s.transform)

  if (guides.length === 0) return null

  return (
    <svg className="bachi-draw-rf-guides" aria-hidden="true">
      {guides.map((g, i) =>
        g.orientation === 'x' ? (
          <line
            key={`x-${i}`}
            x1={g.position * zoom + tx}
            y1={0}
            x2={g.position * zoom + tx}
            y2="100%"
          />
        ) : (
          <line
            key={`y-${i}`}
            x1={0}
            y1={g.position * zoom + ty}
            x2="100%"
            y2={g.position * zoom + ty}
          />
        )
      )}
    </svg>
  )
}
