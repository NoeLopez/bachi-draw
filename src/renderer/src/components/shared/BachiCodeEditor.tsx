import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { tokenizeBachi } from './bachiHighlight'
import { computeSuggestions, isSyntaxKeyword, type SuggestResult } from './bachiSuggest'
import { useCodeEditorWidth } from '../../core/theme/useCodeEditorWidth'
import { listSuggestableIconTypes } from '../../icons/iconCatalog'

export type SaveState = 'saved' | 'pending' | 'saving'

interface BachiCodeEditorProps {
  /** Contenido actual del DSL (fuente de verdad del store). */
  source: string
  /** Emite el nuevo DSL (ya con debounce interno) para preview + auto-guardado. */
  onChange: (next: string) => void
  /** Señala (sin debounce) que el usuario escribió algo: marca "sin guardar". */
  onDirty: () => void
  /** Cierra el panel del editor. */
  onClose: () => void
  /** Mensaje de error de parseo a mostrar, si lo hay. */
  errorMessage?: string | null
  /** Estado del auto-guardado del .bachi, para el indicador del header. */
  saveState: SaveState
  /** Ids conocidos (nodos + grupos) para autocompletar edges y `in <id>`. */
  knownIds: string[]
}

// Retardo antes de propagar lo escrito: redibuja el diagrama tras una breve
// pausa al teclear, sin reparsear en cada pulsación.
const DEBOUNCE_MS = 250

const SAVE_LABEL: Record<SaveState, string> = {
  saved: 'Guardado',
  pending: 'Sin guardar',
  saving: 'Guardando…'
}

const CLOSE_ICON = (
  <svg viewBox="0 0 14 14" width="13" height="13" aria-hidden focusable="false">
    <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

const PLACEHOLDER = `arch-cloud lr

service web(aws/ec2)[Servidor web]
service db(aws/rds)[Base de datos]
web --> db`

// ── Medición del caret (fuente monoespaciada: avance de carácter constante) ──

let measureCanvas: HTMLCanvasElement | null = null

interface CaretMetrics {
  charWidth: number
  lineHeight: number
  padLeft: number
  padTop: number
}

function readMetrics(ta: HTMLTextAreaElement): CaretMetrics {
  const cs = getComputedStyle(ta)
  measureCanvas ??= document.createElement('canvas')
  const ctx = measureCanvas.getContext('2d')
  let charWidth = 7.5
  if (ctx) {
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    charWidth = ctx.measureText('0').width || charWidth
  }
  const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.6
  return {
    charWidth,
    lineHeight,
    padLeft: parseFloat(cs.paddingLeft) || 0,
    padTop: parseFloat(cs.paddingTop) || 0
  }
}

// Coordenadas (relativas al área de edición) justo DEBAJO del caret, para
// anclar ahí el dropdown de sugerencias.
function caretCoords(ta: HTMLTextAreaElement, caret: number): { left: number; top: number } {
  const m = readMetrics(ta)
  const before = ta.value.slice(0, caret)
  const nl = before.lastIndexOf('\n')
  const col = caret - (nl + 1)
  const lineIdx = before.length ? (before.match(/\n/g)?.length ?? 0) : 0
  return {
    left: m.padLeft + col * m.charWidth - ta.scrollLeft,
    top: m.padTop + (lineIdx + 1) * m.lineHeight - ta.scrollTop
  }
}

export default function BachiCodeEditor({
  source,
  onChange,
  onDirty,
  onClose,
  errorMessage,
  saveState,
  knownIds
}: BachiCodeEditorProps): React.JSX.Element {
  const [text, setText] = useState(source)
  const [suggest, setSuggest] = useState<SuggestResult | null>(null)
  const [suggestPos, setSuggestPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const [activeIdx, setActiveIdx] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingCaretRef = useRef<number | null>(null)
  // Último valor que ESTE editor propagó: sirve para ignorar el eco que vuelve
  // por el store y no pisar el cursor mientras se escribe.
  const lastEmittedRef = useRef(source)
  const onChangeRef = useRef(onChange)

  const { width, setWidth } = useCodeEditorWidth()

  // Tipos de icono para autocompletar dentro de `(...)`, deduplicados por icono
  // real (un solo nombre por SVG, el más corto: evita aws/apigateway +
  // aws/api-gateway a la vez).
  const iconTypes = useMemo(() => listSuggestableIconTypes(), [])

  // Línea con error, extraída del mensaje "[línea N, col M] ...".
  const errorLine = useMemo(() => {
    const m = errorMessage?.match(/\[l[íi]nea (\d+)/)
    return m ? Number(m[1]) : null
  }, [errorMessage])

  useEffect(() => {
    onChangeRef.current = onChange
  })

  // Adopta `source` solo cuando el cambio es externo (carga / hot reload / agente),
  // no cuando es el eco de lo que acabamos de emitir nosotros.
  useEffect(() => {
    if (source === lastEmittedRef.current) return
    lastEmittedRef.current = source
    setText(source)
    setSuggest(null)
  }, [source])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // Restaura el caret tras aceptar una sugerencia (una vez aplicado el nuevo texto).
  useLayoutEffect(() => {
    if (pendingCaretRef.current == null) return
    const c = pendingCaretRef.current
    pendingCaretRef.current = null
    const ta = textareaRef.current
    if (ta) {
      ta.focus()
      ta.setSelectionRange(c, c)
    }
  })

  const emitDebounced = (next: string): void => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      lastEmittedRef.current = next
      onChangeRef.current(next)
    }, DEBOUNCE_MS)
  }

  const refreshSuggestions = (value: string, caret: number): void => {
    const result = computeSuggestions(value, caret, knownIds, iconTypes)
    setSuggest(result)
    if (result) {
      setActiveIdx(0)
      if (textareaRef.current) setSuggestPos(caretCoords(textareaRef.current, caret))
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const next = e.target.value
    setText(next)
    onDirty()
    emitDebounced(next)
    refreshSuggestions(next, e.target.selectionStart ?? next.length)
  }

  const acceptSuggestion = (index: number): void => {
    if (!suggest) return
    let insert = suggest.items[index]
    if (!insert) return
    // Tras una palabra clave de sintaxis añadimos espacio (el siguiente token es
    // el id/label); los ids y tipos se insertan tal cual.
    if (isSyntaxKeyword(insert)) insert += ' '
    const next = text.slice(0, suggest.replaceStart) + insert + text.slice(suggest.replaceEnd)
    const caret = suggest.replaceStart + insert.length
    setText(next)
    setSuggest(null)
    onDirty()
    emitDebounced(next)
    pendingCaretRef.current = caret
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!suggest) return
    const n = suggest.items.length
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => (i + 1) % n)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => (i - 1 + n) % n)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      acceptSuggestion(activeIdx)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setSuggest(null)
    }
  }

  // El scroll mueve el medianil y la capa de resaltado; cierra el dropdown
  // (su posición quedaría desfasada).
  const handleScroll = (): void => {
    const ta = textareaRef.current
    if (!ta) return
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop
    if (highlightRef.current) {
      highlightRef.current.scrollTop = ta.scrollTop
      highlightRef.current.scrollLeft = ta.scrollLeft
    }
    if (suggest) setSuggest(null)
  }

  const lineCount = useMemo(() => Math.max(text.split('\n').length, 1), [text])

  // Resaltado por línea (permite marcar la línea de error como un bloque normal
  // que se desplaza con el contenido).
  const renderedLines = useMemo(() => {
    return text.split('\n').map((line, i) => {
      const toks = tokenizeBachi(line)
      return (
        <div key={i} className={`bachi-draw-code-line${i + 1 === errorLine ? ' is-error' : ''}`}>
          {toks.length === 0
            ? '​'
            : toks.map((tok, j) => (
                <span key={j} className={`bachi-tok-${tok.type}`}>
                  {tok.value}
                </span>
              ))}
        </div>
      )
    })
  }, [text, errorLine])

  // Arrastre del borde derecho para redimensionar el panel.
  const startResize = (e: React.PointerEvent): void => {
    e.preventDefault()
    const startX = e.clientX
    const startW = width
    const onMove = (ev: PointerEvent): void => setWidth(startW + (ev.clientX - startX))
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.classList.remove('bachi-col-resizing')
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    document.body.classList.add('bachi-col-resizing')
  }

  return (
    <aside className="bachi-draw-code" style={{ width, flexBasis: width }}>
      <header className="bachi-draw-code-head">
        <span className="bachi-draw-code-title">Código .bachi</span>
        <div className="bachi-draw-code-head-right">
          <span
            className={`bachi-draw-code-save bachi-draw-code-save-${saveState}`}
            data-save-state={saveState}
          >
            <span className="bachi-draw-code-save-dot" aria-hidden />
            {SAVE_LABEL[saveState]}
          </span>
          <button
            type="button"
            className="bachi-draw-code-close"
            onClick={onClose}
            title="Cerrar editor de código"
            aria-label="Cerrar editor de código"
          >
            {CLOSE_ICON}
          </button>
        </div>
      </header>

      <div className="bachi-draw-code-body">
        <div className="bachi-draw-code-gutter" ref={gutterRef} aria-hidden>
          {Array.from({ length: lineCount }, (_, i) => i + 1).map((n) => (
            <div key={n} className={`bachi-draw-code-lineno${n === errorLine ? ' is-error' : ''}`}>
              {n}
            </div>
          ))}
        </div>

        {/* Área de edición: capa de resaltado (detrás) alineada con el textarea
            transparente (delante). El dropdown de sugerencias se ancla aquí. */}
        <div className="bachi-draw-code-editarea">
          <div ref={highlightRef} className="bachi-draw-code-highlight" aria-hidden>
            {renderedLines}
          </div>
          <textarea
            ref={textareaRef}
            className="bachi-draw-code-textarea"
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            onBlur={() => setSuggest(null)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            placeholder={PLACEHOLDER}
          />

          {suggest ? (
            <ul
              className="bachi-draw-code-suggest"
              style={{ left: suggestPos.left, top: suggestPos.top }}
              role="listbox"
            >
              {suggest.items.map((item, i) => (
                <li
                  key={item}
                  role="option"
                  aria-selected={i === activeIdx}
                  className={`bachi-draw-code-suggest-item${i === activeIdx ? ' is-active' : ''}`}
                  // mousedown (no click) + preventDefault: aceptar sin que el
                  // textarea pierda el foco antes de tiempo.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    acceptSuggestion(i)
                  }}
                >
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {errorMessage ? (
        <div className="bachi-draw-code-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {/* Tirador de redimensionado en el borde derecho. */}
      <div
        className="bachi-draw-code-resize"
        onPointerDown={startResize}
        role="separator"
        aria-label="Redimensionar editor"
      />
    </aside>
  )
}
