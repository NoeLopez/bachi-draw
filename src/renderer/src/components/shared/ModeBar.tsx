import { useEditorStore, type EditMode } from '../../core/diagram/editor/store'

interface ModeDef {
  mode: EditMode
  label: string
  shortcut: string
  icon: React.ReactNode
}

const SELECT_ICON = (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden focusable="false">
    <path
      d="M5 3 L5 18 L9 14 L11.5 19 L13.5 18 L11 13 L17 13 Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
    />
  </svg>
)

const PAN_ICON = (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden focusable="false">
    <path
      d="M12 4 v6 M12 4 l-3 3 M12 4 l3 3 M4 12 h6 M4 12 l3 -3 M4 12 l3 3 M20 12 h-6 M20 12 l-3 -3 M20 12 l-3 3 M12 20 v-6 M12 20 l-3 -3 M12 20 l3 -3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const CONNECT_ICON = (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden focusable="false">
    <circle cx="5" cy="12" r="2" fill="currentColor" />
    <path d="M7 12 H17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path
      d="M14 8 L18 12 L14 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const MODES: ModeDef[] = [
  { mode: 'select', label: 'Seleccionar', shortcut: 'V', icon: SELECT_ICON },
  { mode: 'pan', label: 'Mover canvas', shortcut: 'H', icon: PAN_ICON },
  { mode: 'connect', label: 'Conectar nodos', shortcut: 'A', icon: CONNECT_ICON }
]

export default function ModeBar(): React.JSX.Element {
  const mode = useEditorStore((s) => s.mode)
  const setMode = useEditorStore((s) => s.setMode)

  return (
    <div className="diagen-modebar" role="toolbar" aria-label="Modo del editor">
      {MODES.map((m) => (
        <button
          key={m.mode}
          type="button"
          className={`diagen-modebar-btn ${mode === m.mode ? 'is-active' : ''}`}
          onClick={() => setMode(m.mode)}
          title={`${m.label} (${m.shortcut})`}
          aria-pressed={mode === m.mode}
        >
          {m.icon}
        </button>
      ))}
    </div>
  )
}
