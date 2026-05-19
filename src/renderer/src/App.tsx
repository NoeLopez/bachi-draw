import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import EmptyState from './components/shared/EmptyState'
import StatusBar, { ReloadStatus } from './components/shared/StatusBar'
import Toolbar from './components/shared/Toolbar'
import type { DiagramKind, DiagramStat } from './core/diagram/kind'
import { detectKind } from './core/diagram/dispatcher'
import { getKindDef } from './core/diagram/registry'
import {
  clampZoom,
  DEFAULT_VIEWPORT,
  fitToContainer,
  ViewportState
} from './core/renderer/viewportManager'
import { useTheme } from './core/theme/useTheme'

interface OpenedDoc {
  path: string
  content: string
}

interface DiagramState {
  kind: DiagramKind
  layout: unknown
  name: string
  bounds: { width: number; height: number }
  stats: DiagramStat[]
}

function App(): React.JSX.Element {
  const [doc, setDoc] = useState<OpenedDoc | null>(null)
  const [diagram, setDiagram] = useState<DiagramState | null>(null)
  const [status, setStatus] = useState<ReloadStatus>('idle')
  const [statusMessage, setStatusMessage] = useState<string | undefined>()
  const [lastReloadMs, setLastReloadMs] = useState<number | undefined>()
  const [viewport, setViewport] = useState<ViewportState>(DEFAULT_VIEWPORT)
  const runIdRef = useRef(0)
  const { theme, toggleTheme } = useTheme()

  const buildDiagram = useCallback(async (content: string): Promise<void> => {
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
      setDiagram({
        kind,
        layout,
        name: def.getName(layout),
        bounds: def.getBounds(layout),
        stats: def.getStats(layout)
      })
      setLastReloadMs(Math.round(performance.now() - start))
      setStatus('ok')
    } catch (err) {
      if (runIdRef.current !== runId) return
      const message = err instanceof Error ? err.message : String(err)
      setStatus('error')
      setStatusMessage(message)
      // No limpiamos el diagrama previo: el usuario sigue viendo el último válido.
    }
  }, [])

  useEffect(() => {
    const offChanged = window.diagen.onFileChanged(({ path, content }) => {
      setDoc({ path, content })
      void buildDiagram(content)
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
    setDoc({ path: opened.path, content: opened.content })
    void buildDiagram(opened.content)
  }, [buildDiagram])

  const handleSaveArchd = useCallback(async () => {
    if (!doc || !diagram) return
    try {
      const fileName = doc.path.split(/[/\\]/).pop() ?? doc.path
      const def = getKindDef(diagram.kind)
      const archd = def.serialize(fileName, diagram.layout, {
        zoom: viewport.zoom,
        offsetX: viewport.offsetX,
        offsetY: viewport.offsetY,
        width: diagram.bounds.width,
        height: diagram.bounds.height
      })
      const result = await window.diagen.saveArchd(doc.path, archd)
      setStatus('ok')
      setStatusMessage(`Guardado ${result.path.split(/[/\\]/).pop()}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStatus('error')
      setStatusMessage(message)
    }
  }, [doc, diagram, viewport])

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

  // Componente Canvas del kind activo. Se resuelve dinámicamente para
  // soportar múltiples tipos de diagrama (cloud, bpmn, sequence...).
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
        canSave={Boolean(doc && diagram)}
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
      </main>
      <StatusBar
        filePath={doc?.path ?? null}
        stats={diagram?.stats ?? []}
        status={status}
        message={statusMessage}
        lastReloadMs={lastReloadMs}
      />
    </div>
  )
}

export default App
