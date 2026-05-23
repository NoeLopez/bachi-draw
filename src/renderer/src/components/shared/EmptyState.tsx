interface EmptyStateProps {
  onNewFile: () => void
  onOpenFile: () => void
}

/**
 * Pantalla de bienvenida cuando no hay diagrama cargado.
 * Ofrece crear uno nuevo o abrir uno existente.
 */
export default function EmptyState({ onNewFile, onOpenFile }: EmptyStateProps): React.JSX.Element {
  return (
    <div className="bachi-draw-empty-state">
      <div className="bachi-draw-empty-state-card">
        <h2>Bachi Draw</h2>
        <p>Diagramas de arquitectura desde archivos de texto.</p>
        <div className="bachi-draw-empty-actions">
          <button type="button" className="bachi-draw-btn bachi-draw-btn--primary" onClick={onNewFile}>
            Nuevo diagrama
          </button>
          <button type="button" className="bachi-draw-btn" onClick={onOpenFile}>
            Abrir .bachi…
          </button>
        </div>
        <p className="bachi-draw-empty-hint">
          Tip: el archivo se recarga automáticamente cuando un agente lo edita.
        </p>
      </div>
    </div>
  )
}
