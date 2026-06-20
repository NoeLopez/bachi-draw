import { Fragment } from 'react'

interface KeyboardShortcutsModalProps {
  open: boolean
  onClose: () => void
}

interface Shortcut {
  /** Teclas/acciones; varias se muestran encadenadas con "+". */
  keys: string[]
  description: string
}

interface ShortcutGroup {
  title: string
  shortcuts: Shortcut[]
}

// ¿macOS? Para mostrar los símbolos de tecla correctos (⌘ ⇧ ⌥) en vez de Ctrl.
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)

/** Traduce un token de tecla a su representación según la plataforma. */
function formatKey(key: string): string {
  if (key === 'Mod') return IS_MAC ? '⌘' : 'Ctrl'
  if (key === 'Shift') return IS_MAC ? '⇧' : 'Shift'
  if (key === 'Alt') return IS_MAC ? '⌥' : 'Alt'
  return key
}

// Atajos REALES de la app (los que de verdad funcionan hoy), agrupados.
const GROUPS: ShortcutGroup[] = [
  {
    title: 'Archivo',
    shortcuts: [
      { keys: ['Mod', 'S'], description: 'Guardar posiciones (.bachid)' },
      { keys: ['Mod', 'O'], description: 'Abrir archivo .bachi' }
    ]
  },
  {
    title: 'Navegación del lienzo',
    shortcuts: [
      { keys: ['Scroll'], description: 'Desplazar el lienzo' },
      { keys: ['Mod', 'Scroll'], description: 'Zoom' },
      { keys: ['Pellizco'], description: 'Zoom (trackpad)' },
      { keys: ['Clic derecho', 'Arrastrar'], description: 'Pan (mover el lienzo)' }
    ]
  },
  {
    title: 'Selección',
    shortcuts: [
      { keys: ['Clic'], description: 'Seleccionar nodo o arista' },
      { keys: ['Arrastrar en vacío'], description: 'Caja de selección' },
      { keys: ['Clic en vacío'], description: 'Deseleccionar' }
    ]
  },
  {
    title: 'Edición',
    shortcuts: [
      { keys: ['Delete'], description: 'Eliminar lo seleccionado' },
      { keys: ['Doble clic'], description: 'Editar el nombre de un nodo' },
      { keys: ['Arrastrar figura'], description: 'Añadir un nodo (panel de figuras)' }
    ]
  },
  {
    title: 'Editar nombre',
    shortcuts: [
      { keys: ['Enter'], description: 'Confirmar' },
      { keys: ['Shift', 'Enter'], description: 'Nueva línea' },
      { keys: ['Esc'], description: 'Cancelar' }
    ]
  },
  {
    title: 'Vista',
    shortcuts: [
      { keys: ['F5'], description: 'Entrar en modo presentación' },
      { keys: ['Mod', 'Shift', 'P'], description: 'Alternar modo presentación' },
      { keys: ['Esc'], description: 'Salir de presentación / cerrar' },
      { keys: ['?'], description: 'Mostrar esta ayuda' }
    ]
  }
]

const CLOSE_ICON = (
  <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden focusable="false">
    <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

/**
 * Modal de referencia de atajos de teclado. Se abre con `?` o el botón de la
 * toolbar y se cierra con Esc (gestionado en App), la ✕ o clic en el overlay.
 */
export default function KeyboardShortcutsModal({
  open,
  onClose
}: KeyboardShortcutsModalProps): React.JSX.Element | null {
  if (!open) return null

  return (
    <div className="bachi-draw-shortcuts-overlay" onClick={onClose}>
      <div
        className="bachi-draw-shortcuts-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Atajos de teclado"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="bachi-draw-shortcuts-head">
          <h2 className="bachi-draw-shortcuts-title">Atajos de teclado</h2>
          <button
            type="button"
            className="bachi-draw-shortcuts-close"
            onClick={onClose}
            aria-label="Cerrar"
            title="Cerrar"
          >
            {CLOSE_ICON}
          </button>
        </header>

        <div className="bachi-draw-shortcuts-body">
          {GROUPS.map((group) => (
            <section className="bachi-draw-shortcuts-group" key={group.title}>
              <h3 className="bachi-draw-shortcuts-group-title">{group.title}</h3>
              <ul className="bachi-draw-shortcuts-list">
                {group.shortcuts.map((s) => (
                  <li className="bachi-draw-shortcuts-row" key={s.description}>
                    <span className="bachi-draw-shortcuts-desc">{s.description}</span>
                    <span className="bachi-draw-shortcuts-keys">
                      {s.keys.map((k, j) => (
                        <Fragment key={k}>
                          {j > 0 ? <span className="bachi-draw-shortcuts-plus">+</span> : null}
                          <kbd>{formatKey(k)}</kbd>
                        </Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
