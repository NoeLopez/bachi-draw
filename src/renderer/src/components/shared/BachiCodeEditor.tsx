import { useEffect, useMemo, useRef, useState } from 'react'

interface BachiCodeEditorProps {
  /** Contenido actual del DSL (fuente de verdad del store). */
  source: string
  /** Emite el nuevo DSL (ya con debounce interno) para preview + auto-guardado. */
  onChange: (next: string) => void
  /** Cierra el panel del editor. */
  onClose: () => void
  /** Mensaje de error de parseo a mostrar, si lo hay. */
  errorMessage?: string | null
}

// Retardo antes de propagar lo escrito: redibuja el diagrama tras una breve
// pausa al teclear, sin reparsear en cada pulsación.
const DEBOUNCE_MS = 250

const CLOSE_ICON = (
  <svg viewBox="0 0 14 14" width="13" height="13" aria-hidden focusable="false">
    <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

const PLACEHOLDER = `arch-cloud lr

service web(aws/ec2)[Servidor web]
service db(aws/rds)[Base de datos]
web --> db`

export default function BachiCodeEditor({
  source,
  onChange,
  onClose,
  errorMessage
}: BachiCodeEditorProps): React.JSX.Element {
  const [text, setText] = useState(source)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Último valor que ESTE editor propagó: sirve para ignorar el eco que vuelve
  // por el store y no pisar el cursor mientras se escribe.
  const lastEmittedRef = useRef(source)
  const onChangeRef = useRef(onChange)

  // Mantiene la referencia al último `onChange` sin tocar el ref en render.
  useEffect(() => {
    onChangeRef.current = onChange
  })

  // Adopta `source` solo cuando el cambio es externo (carga de archivo, hot
  // reload, edición de un agente), no cuando es el eco de lo que acabamos de
  // emitir nosotros.
  useEffect(() => {
    if (source === lastEmittedRef.current) return
    lastEmittedRef.current = source
    setText(source)
  }, [source])

  // Limpia el timer pendiente al desmontar.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const next = e.target.value
    setText(next)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      lastEmittedRef.current = next
      onChangeRef.current(next)
    }, DEBOUNCE_MS)
  }

  // Mantiene el medianil de números de línea sincronizado con el scroll.
  const handleScroll = (): void => {
    if (gutterRef.current && textareaRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  const lineNumbers = useMemo(() => {
    const count = Math.max(text.split('\n').length, 1)
    return Array.from({ length: count }, (_, i) => i + 1)
  }, [text])

  return (
    <aside className="bachi-draw-code">
      <header className="bachi-draw-code-head">
        <span className="bachi-draw-code-title">Código .bachi</span>
        <button
          type="button"
          className="bachi-draw-code-close"
          onClick={onClose}
          title="Cerrar editor de código"
          aria-label="Cerrar editor de código"
        >
          {CLOSE_ICON}
        </button>
      </header>

      <div className="bachi-draw-code-body">
        <div className="bachi-draw-code-gutter" ref={gutterRef} aria-hidden>
          {lineNumbers.map((n) => (
            <div key={n} className="bachi-draw-code-lineno">
              {n}
            </div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="bachi-draw-code-textarea"
          value={text}
          onChange={handleChange}
          onScroll={handleScroll}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          placeholder={PLACEHOLDER}
        />
      </div>

      {errorMessage ? (
        <div className="bachi-draw-code-error" role="alert">
          {errorMessage}
        </div>
      ) : null}
    </aside>
  )
}
