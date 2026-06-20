import type { DiagramStat } from '../../core/diagram/kind'

export type ReloadStatus = 'idle' | 'reloading' | 'ok' | 'error'

interface StatusBarProps {
  filePath: string | null
  /** true si hay ediciones sin guardar (muestra un ● antes del nombre). */
  dirty?: boolean
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

function filenameFromPath(path: string): string {
  return path.split(/[/\\]/).pop() ?? path
}

export default function StatusBar({
  filePath,
  dirty = false,
  stats,
  status,
  message,
  lastReloadMs
}: StatusBarProps): React.JSX.Element {
  const filename = filePath ? filenameFromPath(filePath) : null

  const metaItems = [
    ...stats.map((s) => `${s.count} ${s.label}`),
    ...(typeof lastReloadMs === 'number' ? [`${lastReloadMs} ms`] : [])
  ]
  const metaText = metaItems.join(' · ')

  const statusText = STATUS_LABEL[status] + (message ? ` · ${message}` : '')

  return (
    <footer className="bachi-draw-status-bar">
      <div className="bachi-draw-status-file" title={filePath ?? ''}>
        {filename && dirty ? (
          <span
            className="bachi-draw-status-dirty"
            aria-label="Cambios sin guardar"
            title="Cambios sin guardar"
          >
            ●{' '}
          </span>
        ) : null}
        {filename ?? '— Sin archivo abierto —'}
      </div>
      <div className="bachi-draw-status-meta">
        {metaText && (
          <>
            <span>{metaText}</span>
            <span className="bachi-draw-status-sep" aria-hidden>
              ·
            </span>
          </>
        )}
        <span className={`bachi-draw-status-dot bachi-draw-status-dot-${status}`} aria-hidden />
        <span className={`bachi-draw-status-state bachi-draw-status-state-${status}`}>
          {statusText}
        </span>
      </div>
    </footer>
  )
}
