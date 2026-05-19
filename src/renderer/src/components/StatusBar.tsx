export type ReloadStatus = 'idle' | 'reloading' | 'ok' | 'error'

interface StatusBarProps {
  filePath: string | null
  nodeCount: number
  edgeCount: number
  clusterCount: number
  status: ReloadStatus
  message?: string
  lastReloadMs?: number
}

const STATUS_LABEL: Record<ReloadStatus, string> = {
  idle: 'Sin archivo',
  reloading: 'Recargando…',
  ok: 'Listo',
  error: 'Error'
}

export default function StatusBar({
  filePath,
  nodeCount,
  edgeCount,
  clusterCount,
  status,
  message,
  lastReloadMs
}: StatusBarProps): React.JSX.Element {
  return (
    <footer className="diagen-status-bar">
      <div className="diagen-status-file" title={filePath ?? ''}>
        {filePath ?? '— Sin archivo abierto —'}
      </div>
      <div className="diagen-status-meta">
        <span>{nodeCount} nodos</span>
        <span>{edgeCount} edges</span>
        <span>{clusterCount} clusters</span>
        {typeof lastReloadMs === 'number' && <span>{lastReloadMs} ms</span>}
        <span className={`diagen-status-pill diagen-status-${status}`}>
          {STATUS_LABEL[status]}
          {message ? ` · ${message}` : ''}
        </span>
      </div>
    </footer>
  )
}
