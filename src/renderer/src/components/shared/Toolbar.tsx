import { useEffect, useRef, useState } from 'react'
import type { Theme } from '../../core/theme/useTheme'
import type { CanvasBackground, DiagramKind } from '../../core/diagram/kind'

interface ToolbarProps {
  diagramName: string
  diagramKind: DiagramKind | null
  theme: Theme
  background: CanvasBackground
  minimapVisible: boolean
  onNewDiagram: () => void
  onNewBoard: () => void
  onOpenFile: () => void
  onSaveArchd: () => void
  onToggleTheme: () => void
  onToggleBackground: () => void
  onToggleMinimap: () => void
  figuresVisible: boolean
  onToggleFigures: () => void
  codeEditorVisible: boolean
  onToggleCodeEditor: () => void
  hasDocument: boolean
  canEditCode: boolean
  canSave: boolean
}

/* ── Iconos ─────────────────────────────────────────────────────────────── */

const CHEVRON_DOWN = (
  <svg viewBox="0 0 12 12" width="10" height="10" fill="none" aria-hidden focusable="false">
    <path
      d="M2.5 4.5L6 8l3.5-3.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const DIAGRAM_ICON = (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden focusable="false">
    <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.3" />
    <path d="M3 7.5h14" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="7" cy="5.25" r="1" fill="currentColor" />
    <circle cx="10" cy="5.25" r="1" fill="currentColor" />
  </svg>
)

const BOARD_ICON = (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden focusable="false">
    <rect x="2" y="2" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M6 7h8M6 10h5M6 13h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
)

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

const CODE_ICON = (
  <svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden focusable="false">
    <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 6l-4 4 4 4" />
      <path d="M13 6l4 4-4 4" />
    </g>
  </svg>
)

const FIGURES_ICON = (
  <svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden focusable="false">
    <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="14" cy="6.5" r="3.5" stroke="currentColor" strokeWidth="1.4" />
    <path
      d="M6.5 11.5l3.5 5.5h-7z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <rect x="11" y="12" width="6" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
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

/* ── Componente ─────────────────────────────────────────────────────────── */

export default function Toolbar({
  diagramName,
  diagramKind,
  theme,
  background,
  minimapVisible,
  onNewDiagram,
  onNewBoard,
  onOpenFile,
  onSaveArchd,
  onToggleTheme,
  onToggleBackground,
  onToggleMinimap,
  figuresVisible,
  onToggleFigures,
  codeEditorVisible,
  onToggleCodeEditor,
  hasDocument,
  canEditCode,
  canSave
}: ToolbarProps): React.JSX.Element {
  const [newMenuOpen, setNewMenuOpen] = useState(false)
  const newMenuRef = useRef<HTMLDivElement>(null)

  const nextThemeLabel = theme === 'dark' ? 'claro' : 'oscuro'
  const nextBackgroundLabel = background === 'dots' ? 'cuadrícula' : 'puntos'
  // El chrome se adapta al contexto: sin documento no hay nada que guardar, editar
  // ni configurar. La pizarra (Excalidraw) gestiona su propia escena, así que el
  // editor de código DSL y los controles de fondo/minimapa solo aplican a cloud.
  const isCloud = diagramKind === 'cloud'
  const isPizarra = diagramKind === 'pizarra'
  const saveTitle = isPizarra ? 'Guardar pizarra (.dark)' : 'Guardar posiciones en .bachid'

  // Cierra el menú al hacer clic fuera de él.
  useEffect(() => {
    if (!newMenuOpen) return
    const handler = (e: MouseEvent): void => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setNewMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [newMenuOpen])

  // Cierra el menú al pulsar Escape.
  useEffect(() => {
    if (!newMenuOpen) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setNewMenuOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [newMenuOpen])

  return (
    <header className="bachi-draw-header">
      {/* Acciones de archivo — izquierda */}
      <div className="bachi-draw-header-left">
        {/* Dropdown "Nuevo" */}
        <div ref={newMenuRef} className="bachi-draw-hmenu-wrap">
          <button
            type="button"
            className={`bachi-draw-hbtn bachi-draw-hbtn-nuevo${newMenuOpen ? ' is-open' : ''}`}
            onClick={() => setNewMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={newMenuOpen}
            title="Crear nuevo archivo"
          >
            Nuevo
            {CHEVRON_DOWN}
          </button>

          {newMenuOpen && (
            <div className="bachi-draw-hmenu" role="menu">
              <button
                type="button"
                role="menuitem"
                className="bachi-draw-hmenu-item"
                onClick={() => {
                  setNewMenuOpen(false)
                  onNewDiagram()
                }}
              >
                {DIAGRAM_ICON}
                <span className="bachi-draw-hmenu-item-body">
                  <span className="bachi-draw-hmenu-item-label">Nuevo diagrama</span>
                  <span className="bachi-draw-hmenu-item-hint">.bachi — arquitectura cloud</span>
                </span>
              </button>

              <div className="bachi-draw-hmenu-sep" role="separator" />

              <button
                type="button"
                role="menuitem"
                className="bachi-draw-hmenu-item"
                onClick={() => {
                  setNewMenuOpen(false)
                  onNewBoard()
                }}
              >
                {BOARD_ICON}
                <span className="bachi-draw-hmenu-item-body">
                  <span className="bachi-draw-hmenu-item-label">Nueva pizarra</span>
                  <span className="bachi-draw-hmenu-item-hint">Lienzo libre de figuras</span>
                </span>
              </button>
            </div>
          )}
        </div>

        <span className="bachi-draw-header-vsep" />

        <button
          type="button"
          className="bachi-draw-hbtn"
          onClick={onOpenFile}
          title="Abrir archivo .bachi existente"
        >
          {FOLDER_ICON}
          Abrir
        </button>
        {/* Guardar solo tiene sentido con un documento abierto. */}
        {hasDocument && (
          <button
            type="button"
            className="bachi-draw-hbtn"
            onClick={onSaveArchd}
            disabled={!canSave}
            title={saveTitle}
          >
            {SAVE_ICON}
            Guardar
          </button>
        )}

        {/* Figuras y Código comparten un único muelle izquierdo: abrir uno cierra
            el otro. Ambos solo aplican a diagramas cloud (.bachi). */}
        {isCloud && (
          <>
            <span className="bachi-draw-header-vsep" />
            <button
              type="button"
              className={`bachi-draw-hbtn${figuresVisible ? ' is-on' : ''}`}
              onClick={onToggleFigures}
              aria-pressed={figuresVisible}
              title={figuresVisible ? 'Ocultar panel de figuras' : 'Mostrar panel de figuras'}
            >
              {FIGURES_ICON}
              Figuras
            </button>
            <button
              type="button"
              className={`bachi-draw-hbtn${codeEditorVisible ? ' is-on' : ''}`}
              onClick={onToggleCodeEditor}
              disabled={!canEditCode}
              aria-pressed={codeEditorVisible}
              title={codeEditorVisible ? 'Ocultar editor de código' : 'Mostrar editor de código'}
            >
              {CODE_ICON}
              Código
            </button>
          </>
        )}
      </div>

      {/* Título centrado — no interactivo */}
      <div className="bachi-draw-header-title-area" aria-hidden>
        <span className="bachi-draw-header-title">{diagramName || 'Bachi Draw'}</span>
      </div>

      {/* Controles de vista — derecha */}
      <div className="bachi-draw-header-right">
        {/* Fondo y minimapa solo aplican al canvas cloud (React Flow). */}
        {isCloud && (
          <div className="bachi-draw-seg" role="group" aria-label="Opciones de vista del lienzo">
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
          </div>
        )}

        {/* El tema es global: siempre disponible, también en la bienvenida. */}
        <div className="bachi-draw-seg" role="group" aria-label="Tema">
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
