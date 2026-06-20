import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import BachiCodeEditor, { type SaveState } from './components/shared/BachiCodeEditor'
import EmptyState from './components/shared/EmptyState'
import FiguresPanel from './components/shared/FiguresPanel'
import StatusBar, { ReloadStatus } from './components/shared/StatusBar'
import Toolbar from './components/shared/Toolbar'
import PresentationOverlay from './components/shared/PresentationOverlay'
import KeyboardShortcutsModal from './components/shared/KeyboardShortcutsModal'
import { detectKind } from './core/diagram/dispatcher'
import { useEditorStore } from './core/diagram/editor/store'
import { getKindDef } from './core/diagram/registry'
import { useTheme } from './core/theme/useTheme'
import { useCanvasBackground } from './core/theme/useCanvasBackground'
import { useMinimapVisible } from './core/theme/useMinimapVisible'
import { useLeftPanel } from './core/theme/useLeftPanel'
import { reconcileLayoutWithArchd } from './core/layout/kinds/cloud/reconcile'
import { getPizarraScene } from './core/state/kinds/pizarra/sceneRegistry'

function filenameWithoutExt(path: string): string {
  const base = path.split(/[/\\]/).pop() ?? path
  return base.replace(/\.[^.]+$/, '')
}

function App(): React.JSX.Element {
  // Estado UI puramente local (no es modelo del diagrama):
  const [status, setStatus] = useState<ReloadStatus>('idle')
  const [statusMessage, setStatusMessage] = useState<string | undefined>()
  const [lastReloadMs, setLastReloadMs] = useState<number | undefined>()
  const runIdRef = useRef(0)
  const { theme, toggleTheme } = useTheme()
  const { background, toggleBackground } = useCanvasBackground()
  const { minimapVisible, toggleMinimap } = useMinimapVisible()
  const { leftPanel, setLeftPanel, toggleFigures, toggleCode } = useLeftPanel()
  // Timer del auto-guardado del DSL (debounce de escritura a disco).
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Estado del auto-guardado del .bachi, para el indicador del editor.
  const [saveState, setSaveState] = useState<SaveState>('saved')
  // Modo presentación: oculta todo el chrome de edición y deja el lienzo limpio.
  const [presentationMode, setPresentationMode] = useState(false)
  // Modal de referencia de atajos de teclado.
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // El estado del diagrama vive en el store. El viewport (zoom/pan/fit) lo
  // gestiona React Flow internamente, así que aquí ya no lo manejamos.
  const diagram = useEditorStore((s) => s.diagram)
  const filePath = useEditorStore((s) => s.filePath)
  const sourceContent = useEditorStore((s) => s.sourceContent)
  const setDiagramInStore = useEditorStore((s) => s.setDiagram)

  const buildDiagram = useCallback(
    async (content: string, path: string, archd?: any, opts?: { fit?: boolean }): Promise<void> => {
      const runId = ++runIdRef.current
      setStatus('reloading')
      setStatusMessage(undefined)
      const start = performance.now()
      try {
        const kind = detectKind(content)
        const def = getKindDef(kind)
        const model = def.parse(content)
        let layout = await def.layout(model)
        if (runIdRef.current !== runId) return

        // Reconcile layout with archd (loaded from disk) or with the existing in-memory layout.
        // The in-memory state is the most fresh visual state (preserving unsaved visual edits).
        // La reconciliación de posiciones es exclusiva del tipo cloud (la pizarra
        // gestiona su propia escena en Excalidraw).
        if (kind === 'cloud') {
          const currentDiagram = useEditorStore.getState().diagram
          const reconciliationSource = archd || currentDiagram?.layout
          if (reconciliationSource) {
            layout = reconcileLayoutWithArchd(layout as any, reconciliationSource)
          }
        }

        const rawName = def.getName(layout)
        const name = rawName || filenameWithoutExt(path)
        setDiagramInStore(
          { kind, model, layout, name, bounds: def.getBounds(layout) },
          path,
          content,
          { fit: opts?.fit ?? true }
        )
        setLastReloadMs(Math.round(performance.now() - start))
        setStatus('ok')
      } catch (err) {
        if (runIdRef.current !== runId) return
        const message = err instanceof Error ? err.message : String(err)
        setStatus('error')
        setStatusMessage(message)
        // No limpiamos el diagrama previo: el usuario sigue viendo el último válido.
      }
    },
    [setDiagramInStore]
  )

  useEffect(() => {
    const offChanged = window.bachiDraw.onFileChanged(({ path, content }) => {
      // Si el contenido coincide con lo que ya tenemos en memoria, es el eco de
      // nuestro propio auto-guardado (o un cambio sin efecto): lo ignoramos.
      if (content === useEditorStore.getState().sourceContent) return
      // Cambio externo (agente / edición manual): memoria y disco quedan en sync.
      setSaveState('saved')
      void buildDiagram(content, path)
    })
    const offError = window.bachiDraw.onFileError(({ message }) => {
      setStatus('error')
      setStatusMessage(message)
    })
    const offRemoved = window.bachiDraw.onFileRemoved(() => {
      setStatus('error')
      setStatusMessage('El archivo fue eliminado')
    })
    return () => {
      offChanged()
      offError()
      offRemoved()
    }
  }, [buildDiagram])

  // Edición en vivo desde el editor de código: redibuja el diagrama sin
  // reencuadrar (fit:false) y auto-guarda el .bachi a disco con debounce.
  const handleSourceChange = useCallback(
    (next: string) => {
      const path = useEditorStore.getState().filePath
      if (!path) return
      void buildDiagram(next, path, undefined, { fit: false })
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        setSaveState('saving')
        window.bachiDraw
          .saveBachi(path, next)
          .then(() => setSaveState('saved'))
          .catch((err) => {
            const message = err instanceof Error ? err.message : String(err)
            setStatus('error')
            setStatusMessage(message)
          })
      }, 500)
    },
    [buildDiagram]
  )

  // El editor avisa (sin debounce) que se escribió: marca "sin guardar".
  const handleDirty = useCallback(() => {
    setSaveState('pending')
  }, [])

  // Limpia el timer de auto-guardado al desmontar.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const handleNewDiagram = useCallback(async () => {
    try {
      const opened = await window.bachiDraw.newDiagram()
      if (!opened) return
      setSaveState('saved')
      void buildDiagram(opened.content, opened.path, opened.archd)
      // Diagrama recién creado (vacío): abrimos el editor para empezar a escribir
      // (el muelle es único, así que esto oculta las figuras hasta que se cierre).
      setLeftPanel('code')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStatus('error')
      setStatusMessage(message)
    }
  }, [buildDiagram, setLeftPanel])

  const handleNewBoard = useCallback(async () => {
    try {
      const opened = await window.bachiDraw.newBoard()
      if (!opened) return
      setSaveState('saved')
      void buildDiagram(opened.content, opened.path, opened.archd)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStatus('error')
      setStatusMessage(message)
    }
  }, [buildDiagram])

  const handleOpenFile = useCallback(async () => {
    const opened = await window.bachiDraw.openFile()
    if (!opened) return
    setSaveState('saved')
    void buildDiagram(opened.content, opened.path, opened.archd)
  }, [buildDiagram])

  const handleSaveArchd = useCallback(async () => {
    if (!filePath || !diagram) return
    try {
      const fileName = filePath.split(/[/\\]/).pop() ?? filePath
      const def = getKindDef(diagram.kind)

      if (diagram.kind === 'pizarra') {
        // La pizarra se guarda directamente en el archivo .dark. Leemos la escena
        // en vivo desde Excalidraw (el store no la copia en cada cambio).
        const scene = getPizarraScene() ?? diagram.layout
        const data = def.serialize(fileName, scene, {
          zoom: 1,
          offsetX: 0,
          offsetY: 0,
          width: 0,
          height: 0
        })
        const result = await window.bachiDraw.savePizarra(filePath, data)
        setStatus('ok')
        setStatusMessage(`Guardado ${result.path.split(/[/\\]/).pop()}`)
        return
      }

      const archd = def.serialize(fileName, diagram.layout, {
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        width: diagram.bounds.width,
        height: diagram.bounds.height
      })
      const result = await window.bachiDraw.saveArchd(filePath, archd)
      setStatus('ok')
      setStatusMessage(`Guardado ${result.path.split(/[/\\]/).pop()}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStatus('error')
      setStatusMessage(message)
    }
  }, [filePath, diagram])

  // Stats genéricos: cada kind sabe contar lo suyo (nodos/edges/clusters).
  const stats = useMemo(() => {
    if (!diagram) return []
    return getKindDef(diagram.kind).getStats(diagram.layout)
  }, [diagram])

  // Canvas del kind activo, resuelto dinámicamente para soportar varios tipos.
  const Canvas = useMemo(() => {
    if (!diagram) return null
    return getKindDef(diagram.kind).Canvas
  }, [diagram])

  // El chrome de la app se adapta al contexto. Los diagramas cloud usan panel de
  // figuras, editor de código DSL, controles de fondo/minimapa e inspector; la
  // pizarra (Excalidraw) gestiona su propia escena y no usa ninguno de ellos.
  const hasDocument = Boolean(diagram)
  const isCloud = diagram?.kind === 'cloud'

  // Ids conocidos (nodos + grupos) del último diagrama cloud parseado, para
  // autocompletar edges y `in <id>` en el editor de código.
  const knownIds = useMemo(() => {
    if (!diagram || diagram.kind !== 'cloud') return []
    const model = diagram.model as {
      nodes?: Array<{ id: string }>
      clusters?: Array<{ id: string }>
    }
    return [...(model.nodes ?? []).map((n) => n.id), ...(model.clusters ?? []).map((c) => c.id)]
  }, [diagram])

  // Entrar/salir del modo presentación. Leemos el diagrama del store (no de la
  // clausura) para que los callbacks sean estables. La pantalla completa nativa
  // es best-effort: si falla (o no está disponible), el modo igual funciona.
  const enterPresentation = useCallback(() => {
    if (!useEditorStore.getState().diagram) return
    setPresentationMode(true)
    window.bachiDraw.enterPresentation?.().catch(() => {})
  }, [])

  const exitPresentation = useCallback(() => {
    setPresentationMode(false)
    window.bachiDraw.exitPresentation?.().catch(() => {})
  }, [])

  // Atajos globales de teclado. Capturamos en fase de captura para tener
  // prioridad (sobre todo con Escape, que también cierra otros elementos).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const el = document.activeElement as HTMLElement | null
      const typing =
        !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)

      // Guardar / Abrir (Cmd/Ctrl). Funcionan aunque el foco esté en un campo.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        const k = e.key.toLowerCase()
        if (k === 's') {
          e.preventDefault()
          void handleSaveArchd()
          return
        }
        if (k === 'o') {
          e.preventDefault()
          void handleOpenFile()
          return
        }
      }

      // "?" abre el panel de atajos (no mientras se escribe en un campo).
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey && !typing) {
        e.preventDefault()
        setShortcutsOpen(true)
        return
      }

      if (e.key === 'F5') {
        e.preventDefault()
        enterPresentation()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        if (presentationMode) exitPresentation()
        else enterPresentation()
        return
      }

      // Escape: primero cierra el modal de atajos; si no, sale de presentación.
      if (e.key === 'Escape') {
        if (shortcutsOpen) {
          e.preventDefault()
          e.stopPropagation()
          setShortcutsOpen(false)
          return
        }
        if (presentationMode) {
          e.preventDefault()
          e.stopPropagation()
          exitPresentation()
        }
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [
    presentationMode,
    shortcutsOpen,
    enterPresentation,
    exitPresentation,
    handleSaveArchd,
    handleOpenFile
  ])

  return (
    <div className={`bachi-draw-app${presentationMode ? ' is-presenting' : ''}`}>
      {/* En modo presentación se oculta todo el chrome de edición. */}
      {!presentationMode && (
        <Toolbar
          diagramName={diagram?.name ?? ''}
          diagramKind={diagram?.kind ?? null}
          theme={theme}
          background={background}
          minimapVisible={minimapVisible}
          onNewDiagram={handleNewDiagram}
          onNewBoard={handleNewBoard}
          onOpenFile={handleOpenFile}
          onSaveArchd={handleSaveArchd}
          onToggleTheme={toggleTheme}
          onToggleBackground={toggleBackground}
          onToggleMinimap={toggleMinimap}
          figuresVisible={leftPanel === 'figures'}
          onToggleFigures={toggleFigures}
          codeEditorVisible={leftPanel === 'code'}
          onToggleCodeEditor={toggleCode}
          onPresent={enterPresentation}
          onShowShortcuts={() => setShortcutsOpen(true)}
          hasDocument={hasDocument}
          canEditCode={Boolean(filePath && isCloud)}
          canSave={Boolean(filePath && diagram)}
        />
      )}
      <main className="bachi-draw-main">
        {!presentationMode && isCloud && leftPanel === 'figures' && (
          <FiguresPanel onClose={toggleFigures} />
        )}
        {!presentationMode && isCloud && leftPanel === 'code' ? (
          <BachiCodeEditor
            source={sourceContent ?? ''}
            onChange={handleSourceChange}
            onDirty={handleDirty}
            onClose={toggleCode}
            errorMessage={status === 'error' ? statusMessage : null}
            saveState={saveState}
            knownIds={knownIds}
          />
        ) : null}
        {Canvas && diagram ? (
          <Canvas
            layout={diagram.layout}
            background={background}
            minimapVisible={minimapVisible}
            presentationMode={presentationMode}
          />
        ) : (
          <div className="bachi-draw-canvas">
            <EmptyState
              onNewDiagram={handleNewDiagram}
              onNewBoard={handleNewBoard}
              onOpenFile={handleOpenFile}
            />
          </div>
        )}
      </main>
      {!presentationMode && (
        <StatusBar
          filePath={filePath}
          stats={stats}
          status={status}
          message={statusMessage}
          lastReloadMs={lastReloadMs}
        />
      )}
      {presentationMode && <PresentationOverlay onExit={exitPresentation} />}
      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  )
}

export default App
