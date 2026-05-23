/**
 * Mensaje que se muestra en el área del canvas cuando no hay diagrama
 * cargado. Es agnóstico del tipo: aplica a cloud, bpmn, sequence, etc.
 */
export default function EmptyState(): React.JSX.Element {
  return (
    <div className="bachi-draw-empty-state">
      <div className="bachi-draw-empty-state-card">
        <h2>Abre un archivo .bachi</h2>
        <p>
          Bachi Draw renderiza diagramas de arquitectura desde archivos de texto.
          <br />
          Usa el botón <strong>Abrir .bachi…</strong> para empezar.
        </p>
        <p className="bachi-draw-empty-hint">
          Tip: el archivo se recarga automáticamente cuando un agente lo edita.
        </p>
      </div>
    </div>
  )
}
