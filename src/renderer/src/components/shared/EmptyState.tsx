interface EmptyStateProps {
  onNewBoard: () => void
  onOpenFile: () => void
}

/**
 * Pantalla de bienvenida cuando no hay nada cargado. Ofrece dos puntos de
 * entrada: abrir un .bachi existente (diagrama cloud) o empezar una pizarra
 * en blanco (lienzo libre de figuras).
 */
export default function EmptyState({ onNewBoard, onOpenFile }: EmptyStateProps): React.JSX.Element {
  return (
    <div className="bachi-draw-empty-state">
      <div className="bachi-draw-empty-state-card">
        <h2>¿Qué quieres crear?</h2>
        <div className="bachi-draw-empty-choices">
          <button type="button" className="bachi-draw-empty-choice" onClick={onOpenFile}>
            <span className="bachi-draw-empty-choice-icon" aria-hidden>
              📐
            </span>
            <span className="bachi-draw-empty-choice-title">Abrir diagrama .bachi</span>
            <span className="bachi-draw-empty-choice-desc">
              Arquitectura cloud desde un archivo de texto
            </span>
          </button>
          <button type="button" className="bachi-draw-empty-choice" onClick={onNewBoard}>
            <span className="bachi-draw-empty-choice-icon" aria-hidden>
              🎨
            </span>
            <span className="bachi-draw-empty-choice-title">Nueva pizarra</span>
            <span className="bachi-draw-empty-choice-desc">Lienzo libre para dibujar y anotar</span>
          </button>
        </div>
        <p className="bachi-draw-empty-hint">
          Tip: los diagramas .bachi se recargan automáticamente cuando un agente los edita.
        </p>
      </div>
    </div>
  )
}
