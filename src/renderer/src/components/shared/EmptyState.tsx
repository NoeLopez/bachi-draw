interface EmptyStateProps {
  onNewDiagram: () => void
  onNewBoard: () => void
  onOpenFile: () => void
}

/* ── Iconos de las tarjetas (line-art, estilo consistente con la toolbar) ──── */

const DIAGRAM_GLYPH = (
  <svg viewBox="0 0 40 40" width="30" height="30" fill="none" aria-hidden focusable="false">
    <rect x="5" y="6" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <rect x="23" y="6" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <rect x="14" y="25" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M11 15v4h9M29 15v4h-9M20 19v6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const BOARD_GLYPH = (
  <svg viewBox="0 0 40 40" width="30" height="30" fill="none" aria-hidden focusable="false">
    <rect x="5" y="7" width="30" height="22" rx="3" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M11 33l3-4M29 33l-3-4M20 29v4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M11 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const OPEN_GLYPH = (
  <svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden focusable="false">
    <path
      d="M2.5 6.5C2.5 5.67 3.17 5 4 5h3.7l1.6 1.6H16c.83 0 1.5.67 1.5 1.5v6c0 .83-.67 1.5-1.5 1.5H4c-.83 0-1.5-.67-1.5-1.5v-7Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
)

/**
 * Pantalla de bienvenida cuando no hay nada cargado. Ofrece los puntos de
 * entrada principales: crear un diagrama cloud (.bachi), crear una pizarra
 * libre (.dark) o abrir un archivo existente.
 */
export default function EmptyState({
  onNewDiagram,
  onNewBoard,
  onOpenFile
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className="bachi-draw-empty-state">
      <div className="bachi-draw-empty-state-card">
        <h2 className="bachi-draw-empty-title">¿Qué quieres crear?</h2>
        <p className="bachi-draw-empty-subtitle">
          Empieza un diagrama de arquitectura o una pizarra en blanco.
        </p>

        <div className="bachi-draw-empty-choices">
          <button type="button" className="bachi-draw-empty-choice" onClick={onNewDiagram}>
            <span className="bachi-draw-empty-choice-icon" aria-hidden>
              {DIAGRAM_GLYPH}
            </span>
            <span className="bachi-draw-empty-choice-title">Nuevo diagrama</span>
            <span className="bachi-draw-empty-choice-desc">
              Arquitectura cloud descrita en texto .bachi
            </span>
          </button>

          <button type="button" className="bachi-draw-empty-choice" onClick={onNewBoard}>
            <span className="bachi-draw-empty-choice-icon" aria-hidden>
              {BOARD_GLYPH}
            </span>
            <span className="bachi-draw-empty-choice-title">Nueva pizarra</span>
            <span className="bachi-draw-empty-choice-desc">Lienzo libre para dibujar y anotar</span>
          </button>
        </div>

        <button type="button" className="bachi-draw-empty-open" onClick={onOpenFile}>
          {OPEN_GLYPH}
          Abrir un archivo existente…
        </button>

        <p className="bachi-draw-empty-hint">
          Los diagramas .bachi se recargan automáticamente cuando un agente los edita.
        </p>
      </div>
    </div>
  )
}
