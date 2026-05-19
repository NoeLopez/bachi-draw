import type { Theme } from '../core/theme/useTheme'

interface ToolbarProps {
  diagramName: string
  zoom: number
  theme: Theme
  onOpenFile: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
  onSaveArchd: () => void
  onToggleTheme: () => void
  canSave: boolean
}

const SUN_ICON = (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden focusable="false">
    <circle cx="12" cy="12" r="4" fill="currentColor" />
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.5" y1="4.5" x2="6.5" y2="6.5" />
      <line x1="17.5" y1="17.5" x2="19.5" y2="19.5" />
      <line x1="4.5" y1="19.5" x2="6.5" y2="17.5" />
      <line x1="17.5" y1="6.5" x2="19.5" y2="4.5" />
    </g>
  </svg>
)

const MOON_ICON = (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden focusable="false">
    <path
      d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
)

export default function Toolbar({
  diagramName,
  zoom,
  theme,
  onOpenFile,
  onZoomIn,
  onZoomOut,
  onResetView,
  onSaveArchd,
  onToggleTheme,
  canSave
}: ToolbarProps): React.JSX.Element {
  const nextThemeLabel = theme === 'dark' ? 'claro' : 'oscuro'
  return (
    <header className="diagen-toolbar">
      <div className="diagen-toolbar-left">
        <button type="button" className="diagen-btn" onClick={onOpenFile}>
          Abrir .arch…
        </button>
        <span className="diagen-toolbar-divider" />
        <h1 className="diagen-toolbar-title">{diagramName || 'Diagen'}</h1>
      </div>
      <div className="diagen-toolbar-right">
        <button
          type="button"
          className="diagen-btn"
          onClick={onSaveArchd}
          disabled={!canSave}
          title="Guardar .archd"
        >
          Guardar .archd
        </button>
        <span className="diagen-toolbar-divider" />
        <button type="button" className="diagen-btn-icon" onClick={onZoomOut} title="Zoom out">
          −
        </button>
        <span className="diagen-zoom-readout">{Math.round(zoom * 100)}%</span>
        <button type="button" className="diagen-btn-icon" onClick={onZoomIn} title="Zoom in">
          +
        </button>
        <button type="button" className="diagen-btn-icon" onClick={onResetView} title="Encuadrar">
          ⤢
        </button>
        <span className="diagen-toolbar-divider" />
        <button
          type="button"
          className="diagen-btn-icon diagen-theme-toggle"
          onClick={onToggleTheme}
          title={`Cambiar a tema ${nextThemeLabel}`}
          aria-label={`Cambiar a tema ${nextThemeLabel}`}
        >
          {theme === 'dark' ? SUN_ICON : MOON_ICON}
        </button>
      </div>
    </header>
  )
}
