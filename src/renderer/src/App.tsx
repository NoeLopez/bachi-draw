import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import EmptyState from './components/shared/EmptyState'
import ModeBar from './components/shared/ModeBar'
import StatusBar, { ReloadStatus } from './components/shared/StatusBar'
import Toolbar from './components/shared/Toolbar'
import { detectKind } from './core/diagram/dispatcher'
import { useEditorStore } from './core/diagram/editor/store'
import { useEditorShortcuts } from './core/diagram/editor/useEditorShortcuts'
import { getKindDef } from './core/diagram/registry'
import {
  clampZoom,
  DEFAULT_VIEWPORT,
  fitToContainer,
  ViewportState
} from './core/renderer/viewportManager'
import { useTheme } from './core/theme/useTheme'

function filenameWithoutExt(path: string): string {
  const base = path.split(/[/\\]/).pop() ?? path
  return base.replace(/\.[^.]+$/, '')
}

function App(): React.JSX.Element {
  // Estado UI puramente local (no es modelo del diagrama):
  const [status, setStatus] = useState<ReloadStatus>('idle')
  const [statusMessage, setStatusMessage] = useState<string | undefined>()
  const [lastReloadMs, setLastReloadMs] = useState<number | undefined>()
  const [viewport, setViewport] = useState<ViewportState>(DEFAULT_VIEWPORT)
  const runIdRef = useRef(0)
  const { theme, toggleTheme } = useTheme()
  useEditorShortcuts()

  // Estado del diagrama vive en el store. Aquí solo nos suscribimos a lo
  // mínimo necesario para que el resto del componente no re-renderice
  // cuando cambian cosas no relacionadas (selección, modo, etc.).
  const diagram = useEditorStore((s) => s.diagram)
  const filePath = useEditorStore((s) => s.filePath)
  const setDiagramInStore = useEditorStore((s) => s.setDiagram)

  const buildDiagram = useCallback(
    async (content: string, path: string): Promise<void> => {
      const runId = ++runIdRef.current
      setStatus('reloading')
      setStatusMessage(undefined)
      const start = performance.now()
      try {
        const kind = detectKind(content)
        const def = getKindDef(kind)
        const model = def.parse(content)
        const layout = await def.layout(model)
        if (runIdRef.current !== runId) return
        const rawName = def.getName(layout)
        const name = rawName || filenameWithoutExt(path)
        setDiagramInStore(
          {
            kind,
            model,
            layout,
            name,
            bounds: def.getBounds(layout)
          },
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
    void buildDiagram(opened.content, opened.path)
  }, [buildDiagram])

  const handleSaveArchd = useCallback(async () => {
    if (!filePath || !diagram) return
    try {
      const fileName = filePath.split(/[/\\]/).pop() ?? filePath
      const def = getKindDef(diagram.kind)
      const archd = def.serialize(fileName, diagram.layout, {
        zoom: viewport.zoom,
        offsetX: viewport.offsetX,
        offsetY: viewport.offsetY,
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
  }, [filePath, diagram, viewport])

  const handleZoomIn = useCallback(() => {
    setViewport((v) => ({ ...v, zoom: clampZoom(v.zoom * 1.2) }))
  }, [])

  const handleZoomOut = useCallback(() => {
    setViewport((v) => ({ ...v, zoom: clampZoom(v.zoom / 1.2) }))
  }, [])

  const handleResetView = useCallback(() => {
    if (!diagram) return
    const container = document.querySelector<HTMLDivElement>('.diagen-canvas')
    if (!container) return
    const rect = container.getBoundingClientRect()
    setViewport(
      fitToContainer(diagram.bounds.width, diagram.bounds.height, rect.width, rect.height)
    )
  }, [diagram])

  const handleAutoFit = useCallback(
    (containerWidth: number, containerHeight: number) => {
      if (!diagram) return
      setViewport(
        fitToContainer(diagram.bounds.width, diagram.bounds.height, containerWidth, containerHeight)
      )
    },
    [diagram]
  )

  // Stats genéricos: cada kind sabe contar lo suyo (nodos/edges/clusters,
  // tasks/gateways, etc.). Recalculado solo cuando cambia el diagrama.
  const stats = useMemo(() => {
    if (!diagram) return []
    return getKindDef(diagram.kind).getStats(diagram.layout)
  }, [diagram])

  // Canvas del kind activo. Se resuelve dinámicamente para soportar varios
  // tipos de diagrama (cloud, bpmn, sequence...).
  const Canvas = useMemo(() => {
    if (!diagram) return null
    return getKindDef(diagram.kind).Canvas
  }, [diagram])

  return (
    <div className="diagen-app">
      <Toolbar
        diagramName={diagram?.name ?? ''}
        zoom={viewport.zoom}
        theme={theme}
        onOpenFile={handleOpenFile}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onSaveArchd={handleSaveArchd}
        onToggleTheme={toggleTheme}
        canSave={Boolean(filePath && diagram)}
      />
      <main className="diagen-main">
        {Canvas && diagram ? (
          <Canvas
            layout={diagram.layout}
            viewport={viewport}
            onViewportChange={setViewport}
            onAutoFit={handleAutoFit}
          />
        ) : (
          <div className="diagen-canvas">
            <EmptyState />
          </div>
        )}
        {diagram && <ModeBar />}
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
