import { useState } from 'react'
import { createPortal } from 'react-dom'
import { getIconDataUri } from '../../../icons/registry'
import type { ExtraHandles } from '../../../core/parser/kinds/cloud/types'
import {
  extraHandlePositions,
  MAX_EXTRA_PER_SIDE,
  SIDES,
  type Side
} from '../../../core/layout/kinds/cloud/connectionHandles'

interface Props {
  /** Datos del nodo a editar. */
  label: string
  iconType: string
  width: number
  height: number
  initial: ExtraHandles | undefined
  onCancel: () => void
  onSave: (extra: ExtraHandles) => void
}

const SIDE_LABEL: Record<Side, string> = {
  top: 'Arriba',
  right: 'Derecha',
  bottom: 'Abajo',
  left: 'Izquierda'
}

// Tamaño del preview (el nodo se dibuja a escala dentro de este recuadro).
const PREVIEW = 180

export default function ConnectionPointsEditor({
  label,
  iconType,
  width,
  height,
  initial,
  onCancel,
  onSave
}: Props): React.JSX.Element {
  const [extra, setExtra] = useState<ExtraHandles>({ ...(initial ?? {}) })
  const [side, setSide] = useState<Side>('right')

  const count = extra[side] ?? 0
  const setCount = (n: number): void =>
    setExtra((prev) => ({ ...prev, [side]: Math.max(0, Math.min(MAX_EXTRA_PER_SIDE, n)) }))

  // Recuadro del nodo dentro del preview, conservando proporción.
  const scale = Math.min((PREVIEW - 60) / width, (PREVIEW - 60) / height)
  const w = width * scale
  const h = height * scale

  return createPortal(
    <div className="bachi-draw-cpe-overlay" onPointerDown={onCancel}>
      <div
        className="bachi-draw-cpe-modal"
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <h3 className="bachi-draw-cpe-title">Editar puntos de conexión</h3>
        <p className="bachi-draw-cpe-sub">
          Los 4 puntos centrales siempre están. Añade puntos extra por lado.
        </p>

        <div className="bachi-draw-cpe-body">
          {/* Controles */}
          <div className="bachi-draw-cpe-controls">
            <label className="bachi-draw-cpe-field">
              <span>Lado</span>
              <select value={side} onChange={(e) => setSide(e.target.value as Side)}>
                {SIDES.map((s) => (
                  <option key={s} value={s}>
                    {SIDE_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>

            <div className="bachi-draw-cpe-field">
              <span>Puntos extra</span>
              <div className="bachi-draw-cpe-stepper">
                <button type="button" onClick={() => setCount(count - 1)} disabled={count <= 0}>
                  −
                </button>
                <span className="bachi-draw-cpe-count">{count}</span>
                <button
                  type="button"
                  onClick={() => setCount(count + 1)}
                  disabled={count >= MAX_EXTRA_PER_SIDE}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bachi-draw-cpe-preview" style={{ width: PREVIEW, height: PREVIEW }}>
            <div className="bachi-draw-cpe-node" style={{ width: w, height: h }}>
              <img className="bachi-draw-cpe-node-icon" src={getIconDataUri(iconType)} alt="" />
              <span className="bachi-draw-cpe-node-label">{label}</span>
              {/* 4 imanes centrales */}
              {(['top', 'right', 'bottom', 'left'] as Side[]).map((s) => (
                <span
                  key={`c-${s}`}
                  className="bachi-draw-cpe-dot is-center"
                  style={dotStyle(s, 50)}
                />
              ))}
              {/* Puntos extra */}
              {SIDES.flatMap((s) =>
                extraHandlePositions(extra[s] ?? 0).map((pct, i) => (
                  <span
                    key={`e-${s}-${i}`}
                    className="bachi-draw-cpe-dot"
                    style={dotStyle(s, pct)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="bachi-draw-cpe-actions">
          <button type="button" className="bachi-draw-btn" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className="bachi-draw-btn bachi-draw-btn-primary"
            onClick={() => onSave(extra)}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/** Posiciona un punto del preview sobre el borde correspondiente. */
function dotStyle(side: Side, pct: number): React.CSSProperties {
  switch (side) {
    case 'top':
      return { left: `${pct}%`, top: 0 }
    case 'bottom':
      return { left: `${pct}%`, top: '100%' }
    case 'left':
      return { left: 0, top: `${pct}%` }
    case 'right':
      return { left: '100%', top: `${pct}%` }
  }
}
