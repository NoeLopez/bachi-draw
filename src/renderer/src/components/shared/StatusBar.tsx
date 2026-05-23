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
    <footer className="bachi-draw-status-bar">
      <div className="bachi-draw-status-file" title={filePath ?? ''}>
        {filePath ?? '— Sin archivo abierto —'}
      </div>
      <div className="bachi-draw-status-meta">
        {stats.map((stat) => (
          <span key={stat.label}>
            {stat.count} {stat.label}
          </span>
        ))}
        {typeof lastReloadMs === 'number' && <span>{lastReloadMs} ms</span>}
        <span className={`bachi-draw-status-pill bachi-draw-status-${status}`}>
          {STATUS_LABEL[status]}
          {message ? ` · ${message}` : ''}
        </span>
      </div>
    </footer>
  )
}
