import { useContext, useEffect, useMemo, useSyncExternalStore } from 'react'
import { BaseEdge, type EdgeProps, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react'
import {
  buildPathWithJumps,
  CORNER_RADIUS,
  parseOrthogonalPath,
  type Pt,
  segmentsOf
} from '../../../core/layout/kinds/cloud/edgeJumps'
import { EdgeToolsContext } from './edgeTools'

// ──────────────────────────────────────────────────────────────────────────
// Edge ortogonal con "saltos" (line hops) OPCIONALES.
//
// Por defecto la arista se dibuja recta. Solo cuando `data.jumps === true`
// (activado a mano desde la paleta flotante de la arista seleccionada) dibuja
// arquitos donde cruza a las demás. Así el cálculo de cruces solo lo hacen las
// pocas aristas que el usuario marca, no todas.
//
// Para saber por dónde saltar, cada arista publica sus puntos a un registro
// compartido; las que saltan leen de ahí las verticales ajenas.
// Convención: salta el segmento HORIZONTAL sobre el VERTICAL (ver edgeJumps.ts).
// ──────────────────────────────────────────────────────────────────────────

const pathRegistry = new Map<string, Pt[]>()
const listeners = new Set<() => void>()
let version = 0

function emit(): void {
  version++
  for (const l of listeners) l()
}

function publishPath(id: string, pts: Pt[] | null): void {
  const prev = pathRegistry.get(id)
  if (pts === null) {
    if (prev) {
      pathRegistry.delete(id)
      emit()
    }
    return
  }
  if (prev && samePts(prev, pts)) return
  pathRegistry.set(id, pts)
  emit()
}

function samePts(a: Pt[], b: Pt[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].x !== b[i].x || a[i].y !== b[i].y) return false
  }
  return true
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export default function JumpEdge(props: EdgeProps): React.JSX.Element {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
    markerStart,
    style,
    label,
    selected,
    data
  } = props

  const jumps = data?.jumps === true
  const tools = useContext(EdgeToolsContext)

  // Dos paths del mismo trazado:
  //  - geomPath (radio 0): vértices rectos, base para detectar cruces.
  //  - roundPath (radio 8): el que se dibuja por defecto, con esquinas suaves.
  // El centro (lx, ly) sirve para el label y la paleta.
  const [geomPath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 0
  })
  const [roundPath, lx, ly] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: CORNER_RADIUS
  })

  // Publica los puntos propios (geometría recta) para que las aristas con
  // saltos consulten por dónde cruzan.
  const ownPts = useMemo(() => parseOrthogonalPath(geomPath), [geomPath])
  useEffect(() => {
    publishPath(id, ownPts)
    return () => publishPath(id, null)
  }, [id, ownPts])

  // Solo las aristas que saltan se suscriben al registro (re-render al cambiar
  // la geometría ajena). Las rectas no necesitan reaccionar.
  useSyncExternalStore(jumps ? subscribe : noopSubscribe, jumps ? () => version : () => 0)

  const d = useMemo(() => {
    // Sin saltos: el path redondeado de React Flow ya es perfecto.
    if (!jumps || !ownPts) return roundPath
    // Con saltos: construimos el trazado nosotros, con esquinas redondeadas y
    // arcos en los cruces.
    const otherSegs: ReturnType<typeof segmentsOf> = []
    for (const [otherId, pts] of pathRegistry) {
      if (otherId === id) continue
      otherSegs.push(...segmentsOf(pts))
    }
    return buildPathWithJumps(ownPts, otherSegs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumps, ownPts, roundPath, id, version])

  return (
    <>
      <BaseEdge id={id} path={d} markerEnd={markerEnd} markerStart={markerStart} style={style} />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="diagen-rf-edge-label"
            style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {selected ? (
        <EdgeLabelRenderer>
          {/* Paleta flotante de la arista seleccionada. nodrag/nopan evita que
              el clic se interprete como interacción del lienzo. */}
          <div
            className="diagen-rf-edge-toolbar nodrag nopan"
            style={{ transform: `translate(-50%, -150%) translate(${lx}px, ${ly}px)` }}
          >
            <button
              type="button"
              className={`diagen-rf-edge-tool ${jumps ? 'is-active' : ''}`}
              title={jumps ? 'Quitar saltos de línea' : 'Saltar las flechas que cruza'}
              onClick={() => tools?.toggleJumps(id)}
            >
              {/* Icono: una línea con joroba (representa el salto). */}
              <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
                <path
                  d="M1 9 H6 A3 3 0 0 1 12 9 H17"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

function noopSubscribe(): () => void {
  return () => {}
}
