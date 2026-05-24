import { useCallback, useEffect, useMemo, useRef, type ComponentProps } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import type { CanvasProps } from '../../../core/diagram/kind'
import type { PizarraLayout } from '../../../core/parser/kinds/pizarra/types'
import { EMPTY_PIZARRA_LAYOUT } from '../../../core/parser/kinds/pizarra/types'
import { useEditorStore } from '../../../core/diagram/editor/store'
import { registerPizarraScene } from '../../../core/state/kinds/pizarra/sceneRegistry'
import { useTheme } from '../../../core/theme/useTheme'

// Tipos derivados del componente público de Excalidraw, sin importar rutas
// internas del paquete. La pizarra guarda elementos/archivos como `unknown`
// (core desacoplado), así que en la frontera con Excalidraw hacemos asserciones
// de tipo puntuales (no `any`).
type ExcalidrawProps = ComponentProps<typeof Excalidraw>
type ExcalidrawAPI = Parameters<NonNullable<ExcalidrawProps['excalidrawAPI']>>[0]
type InitialData = ExcalidrawProps['initialData']
type SceneData = Parameters<ExcalidrawAPI['updateScene']>[0]
type BinaryFilesArg = Parameters<ExcalidrawAPI['addFiles']>[0]

// Debounce para refrescar las stats del store (contador de elementos). No afecta
// al arrastre: Excalidraw está memoizado con props estables, así que aunque el
// store cambie y App re-renderice, Excalidraw NO se vuelve a renderizar.
const STATS_DEBOUNCE = 400

export default function PizarraCanvas({ layout }: CanvasProps<PizarraLayout>): React.JSX.Element {
  const { theme } = useTheme()
  const externalRev = useEditorStore((s) => s.externalRev)
  const updateLayout = useEditorStore((s) => s.updateLayout)
  const excalidrawTheme = theme === 'dark' ? 'dark' : 'light'

  // API imperativa de Excalidraw: recarga la escena en cargas externas y permite
  // leer el estado actual al guardar.
  const apiRef = useRef<ExcalidrawAPI | null>(null)
  // Nombre del documento (no vive en Excalidraw); se mantiene en una ref para
  // leerlo al construir la escena sin recrear callbacks.
  const nameRef = useRef(layout?.name ?? '')
  // Evita que el onChange escriba al store mientras cargamos la escena externamente.
  const loadingRef = useRef(false)
  const statsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    nameRef.current = layout?.name ?? ''
  }, [layout?.name])

  // Construye un PizarraLayout leyendo la escena viva de Excalidraw.
  const readScene = useCallback((api: ExcalidrawAPI): PizarraLayout => {
    const appState = api.getAppState()
    return {
      name: nameRef.current,
      elements: api.getSceneElements(),
      appState: {
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
        zoom: appState.zoom,
        theme: appState.theme
      },
      files: api.getFiles()
    }
  }, [])

  // initialData solo lo lee Excalidraw al montar. Lo memoizamos a la primera
  // escena para no recrear el objeto en cada render. Las recargas posteriores se
  // aplican via updateScene (efecto de abajo), no via initialData.
  const initialData = useMemo(
    () =>
      ({
        elements: layout?.elements ?? [],
        appState: { ...(layout?.appState ?? {}), theme: excalidrawTheme },
        files: layout?.files ?? {}
      }) as unknown as InitialData,
    // Solo en el primer montaje: las recargas van por updateScene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // Cuando llega un layout EXTERNO (nueva carga/hot reload, sube externalRev),
  // reemplazamos la escena via la API imperativa.
  useEffect(() => {
    const api = apiRef.current
    if (!api || !layout) return
    loadingRef.current = true
    api.updateScene({
      elements: layout.elements,
      appState: { ...layout.appState, theme: excalidrawTheme }
    } as unknown as SceneData)
    if (Object.keys(layout.files).length > 0) {
      api.addFiles(Object.values(layout.files) as BinaryFilesArg)
    }
    const t = setTimeout(() => {
      loadingRef.current = false
    }, 50)
    return () => clearTimeout(t)
  }, [externalRev]) // eslint-disable-line react-hooks/exhaustive-deps

  // Publica cómo leer la escena actual para que el guardado la obtenga en vivo
  // desde Excalidraw, sin que el store la copie en cada cambio.
  useEffect(() => {
    registerPizarraScene(() => {
      const api = apiRef.current
      return api ? readScene(api) : (layout ?? EMPTY_PIZARRA_LAYOUT)
    })
    return () => {
      registerPizarraScene(null)
      if (statsTimerRef.current) clearTimeout(statsTimerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // onChange refresca el contador de elementos de la barra de estado (debounced)
  // y marca dirty. La escena exacta se lee al guardar (registro de módulo).
  //
  // CLAVE: guardamos un CLON de los elementos, nunca las referencias vivas de
  // Excalidraw. El store usa Immer, que congela el estado (Object.freeze).
  // Excalidraw mueve las figuras mutando sus objetos; si guardáramos las
  // referencias vivas quedarían congeladas y las figuras ya no se podrían mover
  // tras la primera sincronización (parecería que el lienzo se "congela").
  const handleChange = useCallback(() => {
    if (loadingRef.current) return
    if (statsTimerRef.current) clearTimeout(statsTimerRef.current)
    statsTimerRef.current = setTimeout(() => {
      const api = apiRef.current
      if (!api) return
      const live = readScene(api)
      updateLayout(
        {
          name: live.name,
          elements: structuredClone(live.elements),
          appState: live.appState,
          // Los archivos (imágenes) no hacen falta para el contador; evitamos
          // congelar el mapa vivo de Excalidraw. Al guardar se leen en vivo.
          files: {}
        },
        { width: 0, height: 0 }
      )
    }, STATS_DEBOUNCE)
  }, [updateLayout, readScene])

  const handleApi = useCallback((api: ExcalidrawAPI) => {
    apiRef.current = api
  }, [])

  return (
    <div className="pizarra-canvas-wrapper">
      <Excalidraw
        excalidrawAPI={handleApi}
        initialData={initialData}
        onChange={handleChange}
        theme={excalidrawTheme}
        langCode="es-ES"
      />
    </div>
  )
}
