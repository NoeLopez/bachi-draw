import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import EmptyState from './components/shared/EmptyState'
import StatusBar, { ReloadStatus } from './components/shared/StatusBar'
import Toolbar from './components/shared/Toolbar'
import { detectKind } from './core/diagram/dispatcher'
import { useEditorStore } from './core/diagram/editor/store'
import { getKindDef } from './core/diagram/registry'
import { useTheme } from './core/theme/useTheme'
import { reconcileLayoutWithArchd } from './core/layout/kinds/cloud/reconcile'

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

  // El estado del diagrama vive en el store. El viewport (zoom/pan/fit) lo
  // gestiona React Flow internamente, así que aquí ya no lo manejamos.
  const diagram = useEditorStore((s) => s.diagram)
  const filePath = useEditorStore((s) => s.filePath)
  const setDiagramInStore = useEditorStore((s) => s.setDiagram)

  const buildDiagram = useCallback(
    async (content: string, path: string, archd?: any): Promise<void> => {
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
        const currentDiagram = useEditorStore.getState().diagram
        const reconciliationSource = archd || currentDiagram?.layout

        if (reconciliationSource) {
          layout = reconcileLayoutWithArchd(layout as any, reconciliationSource)
        }

        const rawName = def.getName(layout)
        const name = rawName || filenameWithoutExt(path)
        setDiagramInStore(
          { kind, model, layout, name, bounds: def.getBounds(layout) },
          path,
          content
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
    const offChanged = window.diagen.onFileChanged(({ path, content }) => {
      void buildDiagram(content, path)
    })
    const offError = window.diagen.onFileError(({ message }) => {
      setStatus('error')
      setStatusMessage(message)
    })
    const offRemoved = window.diagen.onFileRemoved(() => {
      setStatus('error')
      setStatusMessage('El archivo fue eliminado')
    })
    return () => {
      offChanged()
      offError()
      offRemoved()
    }
  }, [buildDiagram])

  const handleOpenFile = useCallback(async () => {
    const opened = await window.diagen.openFile()
    if (!opened) return
    void buildDiagram(opened.content, opened.path, opened.archd)
  }, [buildDiagram])

  const handleSaveArchd = useCallback(async () => {
    if (!filePath || !diagram) return
    try {
      const fileName = filePath.split(/[/\\]/).pop() ?? filePath
      const def = getKindDef(diagram.kind)
      const archd = def.serialize(fileName, diagram.layout, {
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        width: diagram.bounds.width,
        height: diagram.bounds.height
      })
      const result = await window.diagen.saveArchd(filePath, archd)
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

  return (
    <div className="diagen-app">
      <Toolbar
        diagramName={diagram?.name ?? ''}
        theme={theme}
        onOpenFile={handleOpenFile}
        onSaveArchd={handleSaveArchd}
        onToggleTheme={toggleTheme}
        canSave={Boolean(filePath && diagram)}
      />
      <main className="diagen-main">
        {Canvas && diagram ? (
          <Canvas layout={diagram.layout} />
        ) : (
          <div className="diagen-canvas">
            <EmptyState />
          </div>
        )}
      </main>
      <StatusBar
        filePath={filePath}
        stats={stats}
        status={status}
        message={statusMessage}
        lastReloadMs={lastReloadMs}
      />
    </div>
  )
}

export default App
