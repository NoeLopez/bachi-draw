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

const FOLDER_ICON = (
  <svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden focusable="false">
    <path
      d="M2.5 7C2.5 6.17 3.17 5.5 4 5.5H8.17L9.83 7H16C16.83 7 17.5 7.67 17.5 8.5V14C17.5 14.83 16.83 15.5 16 15.5H4C3.17 15.5 2.5 14.83 2.5 14V7Z"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinejoin="round"
    />
  </svg>
)

const SAVE_ICON = (
  <svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden focusable="false">
    <path
      d="M10 3.5V12M6.5 9l3.5 3.5L13.5 9"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M4 15.5h12" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
  </svg>
)

const DOTS_ICON = (
  <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden focusable="false">
    <g fill="currentColor">
      <circle cx="5.5" cy="5.5" r="1.4" />
      <circle cx="10" cy="5.5" r="1.4" />
      <circle cx="14.5" cy="5.5" r="1.4" />
      <circle cx="5.5" cy="10" r="1.4" />
      <circle cx="10" cy="10" r="1.4" />
      <circle cx="14.5" cy="10" r="1.4" />
      <circle cx="5.5" cy="14.5" r="1.4" />
      <circle cx="10" cy="14.5" r="1.4" />
      <circle cx="14.5" cy="14.5" r="1.4" />
    </g>
  </svg>
)

const GRID_ICON = (
  <svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden focusable="false">
    <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <line x1="8" y1="3" x2="8" y2="17" />
      <line x1="12" y1="3" x2="12" y2="17" />
      <line x1="3" y1="8" x2="17" y2="8" />
      <line x1="3" y1="12" x2="17" y2="12" />
    </g>
  </svg>
)

const MAP_ICON = (
  <svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden focusable="false">
    <rect x="2.5" y="3.5" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="1.35" />
    <rect x="11.5" y="10" width="5" height="5" rx="1" fill="currentColor" />
  </svg>
)

const SUN_ICON = (
  <svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden focusable="false">
    <circle cx="10" cy="10" r="3.5" fill="currentColor" />
    <g stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
      <line x1="10" y1="2" x2="10" y2="4.5" />
      <line x1="10" y1="15.5" x2="10" y2="18" />
      <line x1="2" y1="10" x2="4.5" y2="10" />
      <line x1="15.5" y1="10" x2="18" y2="10" />
      <line x1="4.1" y1="4.1" x2="5.9" y2="5.9" />
      <line x1="14.1" y1="14.1" x2="15.9" y2="15.9" />
      <line x1="4.1" y1="15.9" x2="5.9" y2="14.1" />
      <line x1="14.1" y1="5.9" x2="15.9" y2="4.1" />
    </g>
  </svg>
)

const MOON_ICON = (
  <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden focusable="false">
    <path d="M17 12.5A7 7 0 1 1 7.5 3a5.5 5.5 0 0 0 9.5 9.5z" fill="currentColor" />
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
  const nextBackgroundLabel = background === 'dots' ? 'cuadrícula' : 'puntos'

  return (
    <header className="bachi-draw-header">
      {/* Acciones de archivo — izquierda */}
      <div className="bachi-draw-header-left">
        <button
          type="button"
          className="bachi-draw-hbtn"
          onClick={onOpenFile}
          title="Abrir archivo .bachi"
        >
          {FOLDER_ICON}
          Abrir
        </button>
        <button
          type="button"
          className="bachi-draw-hbtn"
          onClick={onSaveArchd}
          disabled={!canSave}
          title="Guardar posiciones en .bachid"
        >
          {SAVE_ICON}
          Guardar
        </button>
      </div>

      {/* Título centrado — solo lectura, no interactivo */}
      <div className="bachi-draw-header-title-area" aria-hidden>
        <span className="bachi-draw-header-title">{diagramName || 'Bachi Draw'}</span>
      </div>

      {/* Controles de vista — derecha */}
      <div className="bachi-draw-header-right">
        <div className="bachi-draw-seg" role="group" aria-label="Opciones de vista">
          <button
            type="button"
            className="bachi-draw-seg-btn"
            onClick={onToggleBackground}
            title={`Cambiar fondo a ${nextBackgroundLabel}`}
            aria-label={`Fondo: ${nextBackgroundLabel}`}
          >
            {background === 'dots' ? GRID_ICON : DOTS_ICON}
          </button>
          <button
            type="button"
            className={`bachi-draw-seg-btn${minimapVisible ? ' is-on' : ''}`}
            onClick={onToggleMinimap}
            title={minimapVisible ? 'Ocultar minimapa' : 'Mostrar minimapa'}
            aria-pressed={minimapVisible}
            aria-label="Minimapa"
          >
            {MAP_ICON}
          </button>
          <button
            type="button"
            className="bachi-draw-seg-btn"
            onClick={onToggleTheme}
            title={`Cambiar a tema ${nextThemeLabel}`}
            aria-label={`Tema ${nextThemeLabel}`}
          >
            {theme === 'dark' ? SUN_ICON : MOON_ICON}
          </button>
        </div>
      </div>
    </header>
  )
}
