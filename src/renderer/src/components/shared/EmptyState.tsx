/**
 * Mensaje que se muestra en el área del canvas cuando no hay diagrama
 * cargado. Es agnóstico del tipo: aplica a cloud, bpmn, sequence, etc.
 */
export default function EmptyState(): React.JSX.Element {
  return (
    <div className="diagen-empty-state">
      <div className="diagen-empty-state-card">
        <h2>Abre un archivo .arch</h2>
        <p>
          Diagen renderiza diagramas de arquitectura desde archivos de texto.
          <br />
          Usa el botón <strong>Abrir .arch…</strong> para empezar.
        </p>
        <p className="diagen-empty-hint">
          Tip: el archivo se recarga automáticamente cuando un agente lo edita.
        </p>
      </div>
    </div>
  )
}
