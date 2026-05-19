import type { DiagramStat } from '../../core/diagram/kind'

export type ReloadStatus = 'idle' | 'reloading' | 'ok' | 'error'

interface StatusBarProps {
  filePath: string | null
  stats: DiagramStat[]
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
  stats,
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
        {stats.map((stat) => (
          <span key={stat.label}>
            {stat.count} {stat.label}
          </span>
        ))}
        {typeof lastReloadMs === 'number' && <span>{lastReloadMs} ms</span>}
        <span className={`diagen-status-pill diagen-status-${status}`}>
          {STATUS_LABEL[status]}
          {message ? ` · ${message}` : ''}
        </span>
      </div>
    </footer>
  )
}
