# CLAUDE.md

Guía para trabajar en **Bachi Draw** con Claude Code. Resume la arquitectura real, las convenciones y los puntos no obvios. La documentación de diseño extensa está en [specs/spec-project.md](specs/spec-project.md), pero **ojo: el spec describe el render con SVG nativo y el editor actual migró a React Flow** (ver §"Divergencia importante").

## Qué es Bachi Draw

App de escritorio (Electron + React 19 + TypeScript) para generar diagramas de arquitectura cloud a partir de archivos de texto `.bachi` (un DSL declarativo estilo Mermaid `architecture-beta`), pensada para que agentes de IA escriban el archivo y el diagrama aparezca con hot reload, iconos oficiales y layout automático. Sobre ese visor hay un **editor visual** (React Flow) ya bastante completo: mover nodos, conectar/reconectar aristas, puntos de conexión configurables, editar labels (multilínea), saltos de línea en aristas, panel de figuras con drag&drop para añadir nodos, e inspector contextual de propiedades.

## Comandos

```bash
pnpm install          # instalar dependencias (el repo usa pnpm)
pnpm dev              # arrancar la app en modo desarrollo (electron-vite)
pnpm build            # typecheck + bundle de los 3 procesos (main/preload/renderer)
pnpm typecheck        # typecheck:node + typecheck:web
pnpm typecheck:web    # solo el renderer (lo más rápido durante iteración de UI)
pnpm lint             # eslint con cache
pnpm format           # prettier --write .
pnpm test:e2e         # compila la app y corre los tests E2E (Playwright + Electron)
pnpm test:e2e:run     # corre los tests E2E sin recompilar (requiere out/ ya construido)
```

Tras tocar el renderer, lo habitual es: `pnpm typecheck:web` + `npx eslint <archivo>` + `npx prettier --write <archivo>`.

## Stack

- **Electron** ^39 — shell de escritorio (Chromium bundleado para rendering consistente).
- **electron-vite** ^5 / **Vite** ^7 — build y hot reload de desarrollo.
- **React** ^19 + **TypeScript** ^5.
- **@xyflow/react** (React Flow) ^12 — render e interacción del canvas del editor.
- **elkjs** ^0.11 — motor de layout (algoritmo `layered`), corre en el renderer.
- **Zustand** ^5 + **Immer** — estado del editor.
- **Chokidar** ^5 — file watcher en el main process (hot reload).
- Sin librerías externas para el parser (lexer + recursive descent propio) ni para E2E.

## Arquitectura

### Procesos Electron

- `src/main/` — Node.js. Crea la ventana, observa el `.bachi` con Chokidar ([fileWatcher.ts](src/main/fileWatcher.ts)), lee/escribe archivos ([fileManager.ts](src/main/fileManager.ts)) y expone IPC ([ipcHandlers.ts](src/main/ipcHandlers.ts): `open-file-dialog`, `open-file-path`, `save-archd`, `stop-watching`, `resolve-arch-name`).
- `src/preload/` — expone `window.bachiDraw` al renderer vía contextBridge (`onFileChanged`, `openFile`, `saveArchd`, ...).
- `src/renderer/` — React. Todo el pipeline de parse → layout → render vive aquí.

### Pipeline de datos

```
archivo .bachi (DSL)
  → detectKind()            core/diagram/dispatcher.ts — lee header "arch-<kind>"
  → def.parse()             parser (lexer + recursive descent) → CloudGraph (modelo)
  → def.layout()            elkjs (layered) → LayoutResult (coords ABSOLUTAS)
  → reconcileLayoutWithArchd()  fusiona posiciones guardadas (.bachid o estado en memoria)
  → toReactFlow()           LayoutResult → nodos/edges de React Flow (coords RELATIVAS al padre)
  → <ReactFlow>             render + interacción (CloudCanvas.tsx)
```

### Arquitectura multi-tipo

Cada "tipo de diagrama" (hoy solo `cloud`) implementa `DiagramKindDef` ([core/diagram/kind.ts](src/renderer/src/core/diagram/kind.ts)) y se registra en [core/diagram/registry.ts](src/renderer/src/core/diagram/registry.ts). Un kind aporta: `parse`, `layout`, `Canvas`, `getName`, `getBounds`, `getStats`, `serialize`. **Regla de diseño: añadir un tipo nuevo no debe requerir tocar el código de los demás.** El código específico vive bajo `core/<capa>/kinds/<kind>/` y `components/kinds/<kind>/`.

### Dos formatos de archivo

- `.bachi` — DSL, **fuente de verdad de la topología**. Lo escribe la IA o el humano.
- `.bachid` — JSON con posiciones, **estado visual derivado y regenerable**. Lo escribe la app. Si existe junto al `.bachi`, sus posiciones se reconcilian sobre el layout de ELK para preservar ediciones manuales.

## Divergencia importante: SVG → React Flow

El spec ([specs/spec-project.md](specs/spec-project.md) §10, §15) describe render con **SVG nativo** y viewport propio. El editor **abandonó ese enfoque** y migró a **React Flow** para obtener selección, drag, zoom y conexión sin reimplementarlos (todo está ya en `master`). Al leer el spec, recordar que la implementación divergió aquí.

- **Borrados:** `NodeElement`, `EdgeElement`, `ClusterElement`, `LabelEditor`, `SVGViewport`, `ModeBar`, `useEditorShortcuts`, `viewportManager`, `editOps`.
- **Reemplazos:** [ServiceNode.tsx](src/renderer/src/components/kinds/cloud/ServiceNode.tsx), [GroupNode.tsx](src/renderer/src/components/kinds/cloud/GroupNode.tsx), [NodeLabelInput.tsx](src/renderer/src/components/kinds/cloud/NodeLabelInput.tsx), y [CloudCanvas.tsx](src/renderer/src/components/kinds/cloud/CloudCanvas.tsx) (el componente central del editor).

### Componente central: CloudCanvas

[CloudCanvas.tsx](src/renderer/src/components/kinds/cloud/CloudCanvas.tsx) envuelve `<ReactFlow>` y gestiona casi todo el editor:

- Conversión `LayoutResult` ↔ nodos/edges de React Flow ([toReactFlow.ts](src/renderer/src/core/layout/kinds/cloud/toReactFlow.ts)).
- **Crear** aristas (`onConnect`, ids únicos vía `uniqueEdgeId` para permitir varias entre el mismo par) y **reconectar** existentes (`onReconnectStart`/`onReconnect`/`onReconnectEnd`; soltar en el vacío borra la arista).
- **Imán de alineación** al arrastrar nodos ([alignment.ts](src/renderer/src/core/layout/kinds/cloud/alignment.ts) + [AlignmentGuides.tsx](src/renderer/src/components/kinds/cloud/AlignmentGuides.tsx)): si el centro del nodo cae dentro de `SNAP_THRESHOLD` (8px) del centro de otro, engancha a esa línea recta y muestra guías punteadas. Los grupos no se enganchan.
- **Drag & drop desde el panel de figuras** (`onDrop`/`onDragOver`): crea un nodo de servicio nuevo donde se suelta (`screenToFlowPosition`, `uniqueNodeId`). El tipo de icono viaja en el `dataTransfer` (`ICON_DND_TYPE`).
- **Interacción estilo Figma/Lucid:** clic izquierdo selecciona / caja de selección en vacío (`selectionOnDrag`, `SelectionMode.Partial`); clic derecho hace pan (`panOnDrag={[2]}`). `connectionRadius=60` para enganchar al soltar cerca de un nodo.
- Edición inline de label (doble click → `data.editing` → `NodeLabelInput`, que es un `<textarea>` multilínea: Enter confirma, Shift+Enter salta de línea).
- Sincronización al store (`syncToStore` → `updateLayoutWithReactFlow` → `updateLayout`).

### Puntos de conexión, aristas e inspector

- **Handles:** cada `ServiceNode` tiene 4 imanes centrales (ids `t`/`r`/`b`/`l`, los que persisten las aristas guardadas) + puntos extra configurables por lado ([connectionHandles.ts](src/renderer/src/core/layout/kinds/cloud/connectionHandles.ts) reparte y nombra `et0`/`er0`...). Los handles viven en una capa que coincide con el icono (no con el recuadro del nodo). Al cambiar la config hay que llamar `useUpdateNodeInternals` o React Flow no recalcula los bounds y los handles nuevos no conectan.
- **Editor de puntos de conexión:** modal [ConnectionPointsEditor.tsx](src/renderer/src/components/kinds/cloud/ConnectionPointsEditor.tsx), se abre desde el inspector.
- **Aristas con saltos (line hops):** edge type `jump` ([JumpEdge.tsx](src/renderer/src/components/kinds/cloud/JumpEdge.tsx) + [edgeJumps.ts](src/renderer/src/core/layout/kinds/cloud/edgeJumps.ts)). Opcional por arista (`data.jumps`): dibuja un arco donde cruza a otras. Cada arista publica sus puntos a un registro de módulo; las que saltan leen las verticales ajenas. Esquinas redondeadas (radio en `CORNER_RADIUS`).
- **Inspector contextual:** panel derecho [CloudInspector.tsx](src/renderer/src/components/kinds/cloud/CloudInspector.tsx), aparece solo con selección única; reúne las propiedades del nodo/arista (puntos, estilo sólida/punteada, dirección, saltos). Reemplazó a las antiguas paletas flotantes. `edgeVisuals` (en toReactFlow) deriva markers/dasharray de `data.style`/`data.direction`.
- **Panel de figuras:** lateral izquierdo [FiguresPanel.tsx](src/renderer/src/components/shared/FiguresPanel.tsx), buscador + iconos agrupados por categoría, items arrastrables.
- **No perder el zoom al editar:** el store tiene `externalRev`, que solo aumenta al cargar un layout externo (archivo/hot reload). El efecto de re-siembra + `fitView` depende de `externalRev`, **no** del `layout`; así las ediciones del usuario (que pasan por `updateLayout`) nunca reencuadran. NO llamar `setDiagram` desde una edición.

### Detalles no obvios de React Flow

- **Coordenadas:** ELK da posiciones **absolutas**; React Flow usa posiciones **relativas al nodo padre** para anidación en clusters. Las conversiones restan/suman el offset del contenedor (ver `toReactFlow` y `alignment.ts`). Para comparar nodos de distintos clusters siempre se trabaja en absolutas.
- **Orden de nodos:** un hijo debe ir en el array _después_ de su padre; los clusters se emiten ordenados por profundidad (ancestros primero).
- **`nodeTypes` se define fuera del componente** — React Flow exige referencia estable o re-renderiza todo.
- **Routing de aristas:** lo hace React Flow (`smoothstep`), **no** se reutilizan los bend points de ELK.
- **Snap al soltar:** React Flow emite un último cambio con la posición real del cursor (sin snap) al hacer `dragStop`. Por eso `onNodeDragStop` **reaplica** el imán sobre la posición final; si no, reaparece el efecto escalera.

## Iconos

- [icons/registry.ts](src/renderer/src/icons/registry.ts) genera **placeholders SVG** (badge con color+texto por tipo, ej. `aws/ec2`).
- [icons/officialIcons.ts](src/renderer/src/icons/officialIcons.ts) auto-descubre los **SVG oficiales** con `import.meta.glob`. `getIconDataUri()` prefiere el oficial sobre el placeholder.
- **307 iconos oficiales de AWS** organizados por **categoría** en subcarpetas: `icons/aws/<categoria>/<servicio>.svg` (ej. `aws/compute/ec2.svg`). **Detalle clave:** el path es solo organización física; el **tipo lógico es plano** (`aws/ec2`, ignora la categoría), así los `.bachi` y los aliases no dependen de la categoría. `getIconCategory(type)` da la categoría (metadato para agrupar el panel). Excepción: `aws/groups/*` (bordes de cluster) conservan el path en el tipo.
- Mismo patrón aplicará a `gcp/`, `azure/`, etc. cuando se añadan (hoy vacíos).
- **Ojo con Vite:** los SVG <4KB se inlinean como data-uri (no generan archivo físico en el bundle) y los mayores se emiten como archivo hasheado. Contar archivos `.svg` en `out/` engaña: ambas formas son válidas y todos los tipos están en el map.

## Convenciones

- **Comentarios y mensajes de commit en español.** Identificadores y términos técnicos en su forma original.
- Indentación de 2 espacios, sin punto y coma final (config de Prettier del repo). Correr `pnpm format` si hay dudas.
- Imports tipo: `import { type Foo }` o `import type { Foo }`.
- Ejemplos `.bachi` de referencia en [resources/](resources/): `example.bachi`, `aws-deployment.bachi`, `enterprise-saas.bachi` (71 nodos, 19 clusters, 98 edges — el caso grande).

## Estado actual y cabos sueltos

El editor visual está bastante completo (todo en `master`): selección/caja, pan, conexión por puntos con editor, reconexión, saltos de línea, imán de alineación, edición inline multilínea, marco de selección estilo Lucid, inspector lateral, fondo configurable (puntos/cuadrícula), y panel de figuras con iconos AWS por categoría + drag&drop. Cabos sueltos:

- **No se escribe al `.bachi` todavía.** Las ediciones visuales se guardan en el `.bachid` (JSON), no en el DSL. **`serializeCloud` ([serialize.ts](src/renderer/src/core/parser/kinds/cloud/serialize.ts)) está escrito pero no conectado** (reconstruye el `.bachi` desde un `CloudGraph`, pero nada lo importa). `App.tsx`/`handleSaveArchd` usa `def.serialize` → `serializeArchd` (el `.bachid`), que es **otro** serializador. Conectarlo requeriría reconstruir el `model` (CloudGraph) desde el estado editado de React Flow (hoy `updateLayoutWithReactFlow` solo actualiza el `LayoutResult`, no el `model`).
- **Labels multilínea y `.bachi`:** al conectar `serializeCloud`, los `\n` de un label dentro de `[...]` romperían la sintaxis del DSL — habrá que escaparlos.
- **Drop dentro de un cluster:** un nodo soltado "dentro" de un grupo se crea top-level (no se le asigna `clusterId`).

## Verificación

Hay tests **E2E con Playwright** que lanzan la app Electron compilada y la conducen como un usuario (carpeta [e2e/](e2e/), config [playwright.config.ts](playwright.config.ts)). Hoy cubren el tipo `pizarra` ([e2e/pizarra.spec.ts](e2e/pizarra.spec.ts)): dibujar/mover figuras, contador de elementos, guardado y la regresión del bucle de re-render que congelaba el canvas. Se corren con `pnpm test:e2e` (compila primero) o `pnpm test:e2e:run` (sobre `out/` ya construido).

Detalles no obvios del setup E2E (en [e2e/helpers.ts](e2e/helpers.ts)):

- **Cada test lanza una app fresca** (`beforeEach`/`afterEach`): el estado del editor y la escena de Excalidraw no se comparten entre tests.
- **El diálogo nativo de archivos no es accesible** desde Playwright. Para cargar un documento sin diálogo, `loadDocument` usa `app.evaluate` y emite el IPC `arch-file-changed` desde el main, igual que un hot reload del file watcher.
- **Dibujar/mover** se hace con `page.mouse` sobre el canvas de Excalidraw; dibujar en el **centro** del canvas evita el panel de propiedades izquierdo (que tapa la esquina superior izquierda al activar una herramienta).
- Playwright transpila los tests a **CommonJS** (el proyecto no es `type: module`): usar `__dirname`, no `import.meta.url`.

El `.bachi`/`.dark` también se puede abrir a mano con `pnpm dev` y el diálogo nativo. Cabe extender los specs a `cloud` cuando haga falta.
