import type { Theme } from '../../core/theme/useTheme'
import type { CanvasBackground } from '../../core/diagram/kind'

interface ToolbarProps {
  diagramName: string
  theme: Theme
  background: CanvasBackground
  minimapVisible: boolean
  onOpenFile: () => void
  onSaveArchd: () => void
  onToggleTheme: () => void
  onToggleBackground: () => void
  onToggleMinimap: () => void
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

const DOTS_ICON = (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden focusable="false">
    <g fill="currentColor">
      <circle cx="6" cy="6" r="1.6" />
      <circle cx="12" cy="6" r="1.6" />
      <circle cx="18" cy="6" r="1.6" />
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
      <circle cx="6" cy="18" r="1.6" />
      <circle cx="12" cy="18" r="1.6" />
      <circle cx="18" cy="18" r="1.6" />
    </g>
  </svg>
)

const GRID_ICON = (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden focusable="false">
    <g stroke="currentColor" strokeWidth="1.6">
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
    </g>
  </svg>
)

const MAP_ICON = (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden focusable="false">
    <rect
      x="3"
      y="4"
      width="18"
      height="16"
      rx="2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <rect x="13" y="12" width="6" height="6" rx="1" fill="currentColor" />
  </svg>
)

export default function Toolbar({
  diagramName,
  theme,
  background,
  minimapVisible,
  onOpenFile,
  onSaveArchd,
  onToggleTheme,
  onToggleBackground,
  onToggleMinimap,
  canSave
}: ToolbarProps): React.JSX.Element {
  const nextThemeLabel = theme === 'dark' ? 'claro' : 'oscuro'
  // Muestra el icono del tipo AL QUE se cambiará al pulsar.
  const nextBackgroundLabel = background === 'dots' ? 'cuadrícula' : 'puntos'
  return (
    <header className="bachi-draw-toolbar">
      <div className="bachi-draw-toolbar-left">
        <button type="button" className="bachi-draw-btn" onClick={onOpenFile}>
          Abrir .bachi…
        </button>
        <span className="bachi-draw-toolbar-divider" />
        <h1 className="bachi-draw-toolbar-title">{diagramName || 'Bachi Draw'}</h1>
      </div>
      <div className="bachi-draw-toolbar-right">
        <button
          type="button"
          className="bachi-draw-btn"
          onClick={onSaveArchd}
          disabled={!canSave}
          title="Guardar .bachid"
        >
          Guardar .bachid
        </button>
        <span className="bachi-draw-toolbar-divider" />
        <button
          type="button"
          className="bachi-draw-btn-icon"
          onClick={onToggleBackground}
          title={`Fondo: ${nextBackgroundLabel}`}
          aria-label={`Cambiar fondo a ${nextBackgroundLabel}`}
        >
          {background === 'dots' ? GRID_ICON : DOTS_ICON}
        </button>
        <button
          type="button"
          className={`bachi-draw-btn-icon${minimapVisible ? ' is-active' : ''}`}
          onClick={onToggleMinimap}
          title={minimapVisible ? 'Ocultar minimapa' : 'Mostrar minimapa'}
          aria-label={minimapVisible ? 'Ocultar minimapa' : 'Mostrar minimapa'}
          aria-pressed={minimapVisible}
        >
          {MAP_ICON}
        </button>
        <button
          type="button"
          className="bachi-draw-btn-icon bachi-draw-theme-toggle"
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
