import { useCallback, useEffect, useRef, useState } from 'react'
import DiagramCanvas from './components/DiagramCanvas'
import StatusBar, { ReloadStatus } from './components/StatusBar'
import Toolbar from './components/Toolbar'
import { ArchParseError, parseArch } from './core/parser/archParser'
import type { LayoutResult } from './core/parser/types'
import { runLayout } from './core/layout/elkRunner'
import { serializeArchd } from './core/state/archdSerializer'
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

function App(): React.JSX.Element {
  const [doc, setDoc] = useState<OpenedDoc | null>(null)
  const [layout, setLayout] = useState<LayoutResult | null>(null)
  const [status, setStatus] = useState<ReloadStatus>('idle')
  const [statusMessage, setStatusMessage] = useState<string | undefined>()
  const [lastReloadMs, setLastReloadMs] = useState<number | undefined>()
  const [viewport, setViewport] = useState<ViewportState>(DEFAULT_VIEWPORT)
  const runIdRef = useRef(0)
  const { theme, toggleTheme } = useTheme()

  const buildLayout = useCallback(async (content: string): Promise<void> => {
    const runId = ++runIdRef.current
    setStatus('reloading')
    setStatusMessage(undefined)
    const start = performance.now()
    try {
      const graph = parseArch(content)
      const result = await runLayout(graph)
      if (runIdRef.current !== runId) return
      setLayout(result)
      setLastReloadMs(Math.round(performance.now() - start))
      setStatus('ok')
    } catch (err) {
      if (runIdRef.current !== runId) return
      const message =
        err instanceof ArchParseError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err)
      setStatus('error')
      setStatusMessage(message)
      // No limpiamos el layout previo: el usuario sigue viendo el último válido.
    }
  }, [])

  // Atender cambios del file watcher del main process.
  useEffect(() => {
    const offChanged = window.diagen.onFileChanged(({ path, content }) => {
      setDoc({ path, content })
      void buildLayout(content)
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
  }, [buildLayout])

  const handleOpenFile = useCallback(async () => {
    const opened = await window.diagen.openFile()
    if (!opened) return
    setDoc({ path: opened.path, content: opened.content })
    void buildLayout(opened.content)
  }, [buildLayout])

  const handleSaveArchd = useCallback(async () => {
    if (!doc || !layout) return
    try {
      const fileName = doc.path.split(/[/\\]/).pop() ?? doc.path
      const archd = serializeArchd(fileName, layout, {
        zoom: viewport.zoom,
        offsetX: viewport.offsetX,
        offsetY: viewport.offsetY,
        width: layout.width,
        height: layout.height
      })
      const result = await window.diagen.saveArchd(doc.path, archd)
      setStatus('ok')
      setStatusMessage(`Guardado ${result.path.split(/[/\\]/).pop()}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStatus('error')
      setStatusMessage(message)
    }
  }, [doc, layout, viewport])

  const handleZoomIn = useCallback(() => {
    setViewport((v) => ({ ...v, zoom: clampZoom(v.zoom * 1.2) }))
  }, [])

  const handleZoomOut = useCallback(() => {
    setViewport((v) => ({ ...v, zoom: clampZoom(v.zoom / 1.2) }))
  }, [])

  const handleResetView = useCallback(() => {
    if (!layout) return
    const container = document.querySelector<HTMLDivElement>('.diagen-canvas')
    if (!container) return
    const rect = container.getBoundingClientRect()
    setViewport(fitToContainer(layout.width, layout.height, rect.width, rect.height))
  }, [layout])

  const handleAutoFit = useCallback(
    (containerWidth: number, containerHeight: number) => {
      if (!layout) return
      setViewport(fitToContainer(layout.width, layout.height, containerWidth, containerHeight))
    },
    [layout]
  )

  const diagramName = layout?.name ?? ''

  return (
    <div className="diagen-app">
      <Toolbar
        diagramName={diagramName}
        zoom={viewport.zoom}
        theme={theme}
        onOpenFile={handleOpenFile}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onSaveArchd={handleSaveArchd}
        onToggleTheme={toggleTheme}
        canSave={Boolean(doc && layout)}
      />
      <main className="diagen-main">
        <DiagramCanvas
          layout={layout}
          viewport={viewport}
          onViewportChange={setViewport}
          onAutoFit={handleAutoFit}
        />
      </main>
      <StatusBar
        filePath={doc?.path ?? null}
        nodeCount={layout?.nodes.length ?? 0}
        edgeCount={layout?.edges.length ?? 0}
        clusterCount={layout?.clusters.length ?? 0}
        status={status}
        message={statusMessage}
        lastReloadMs={lastReloadMs}
      />
    </div>
  )
}

export default App
