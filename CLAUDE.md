# CLAUDE.md

Guía para trabajar en **Diagen** con Claude Code. Resume la arquitectura real, las convenciones y los puntos no obvios. La documentación de diseño extensa está en [specs/spec-project.md](specs/spec-project.md), pero **ojo: el spec describe el render con SVG nativo y el editor actual migró a React Flow** (ver §"Divergencia importante").

## Qué es Diagen

App de escritorio (Electron + React 19 + TypeScript) para generar diagramas de arquitectura cloud a partir de archivos de texto `.arch` (un DSL declarativo estilo Mermaid `architecture-beta`), pensada para que agentes de IA escriban el archivo y el diagrama aparezca con hot reload, iconos oficiales y layout automático. Sobre ese visor se está construyendo un **editor visual** (mover nodos, conectar, reconectar, editar labels) con React Flow.

## Comandos

```bash
pnpm install          # instalar dependencias (el repo usa pnpm)
pnpm dev              # arrancar la app en modo desarrollo (electron-vite)
pnpm build            # typecheck + bundle de los 3 procesos (main/preload/renderer)
pnpm typecheck        # typecheck:node + typecheck:web
pnpm typecheck:web    # solo el renderer (lo más rápido durante iteración de UI)
pnpm lint             # eslint con cache
pnpm format           # prettier --write .
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

- `src/main/` — Node.js. Crea la ventana, observa el `.arch` con Chokidar ([fileWatcher.ts](src/main/fileWatcher.ts)), lee/escribe archivos ([fileManager.ts](src/main/fileManager.ts)) y expone IPC ([ipcHandlers.ts](src/main/ipcHandlers.ts): `open-file-dialog`, `open-file-path`, `save-archd`, `stop-watching`, `resolve-arch-name`).
- `src/preload/` — expone `window.diagen` al renderer vía contextBridge (`onFileChanged`, `openFile`, `saveArchd`, ...).
- `src/renderer/` — React. Todo el pipeline de parse → layout → render vive aquí.

### Pipeline de datos

```
archivo .arch (DSL)
  → detectKind()            core/diagram/dispatcher.ts — lee header "arch-<kind>"
  → def.parse()             parser (lexer + recursive descent) → CloudGraph (modelo)
  → def.layout()            elkjs (layered) → LayoutResult (coords ABSOLUTAS)
  → reconcileLayoutWithArchd()  fusiona posiciones guardadas (.archd o estado en memoria)
  → toReactFlow()           LayoutResult → nodos/edges de React Flow (coords RELATIVAS al padre)
  → <ReactFlow>             render + interacción (CloudCanvas.tsx)
```

### Arquitectura multi-tipo

Cada "tipo de diagrama" (hoy solo `cloud`) implementa `DiagramKindDef` ([core/diagram/kind.ts](src/renderer/src/core/diagram/kind.ts)) y se registra en [core/diagram/registry.ts](src/renderer/src/core/diagram/registry.ts). Un kind aporta: `parse`, `layout`, `Canvas`, `getName`, `getBounds`, `getStats`, `serialize`. **Regla de diseño: añadir un tipo nuevo no debe requerir tocar el código de los demás.** El código específico vive bajo `core/<capa>/kinds/<kind>/` y `components/kinds/<kind>/`.

### Dos formatos de archivo

- `.arch` — DSL, **fuente de verdad de la topología**. Lo escribe la IA o el humano.
- `.archd` — JSON con posiciones, **estado visual derivado y regenerable**. Lo escribe la app. Si existe junto al `.arch`, sus posiciones se reconcilian sobre el layout de ELK para preservar ediciones manuales.

## Divergencia importante: SVG → React Flow

El spec ([specs/spec-project.md](specs/spec-project.md) §10, §15) describe render con **SVG nativo** y viewport propio. La rama `feature/react-flow-editor` **abandonó ese enfoque** y migró a **React Flow** para obtener el editor visual (selección, drag, zoom, conexión) sin reimplementarlo. Al leer el spec, recordar que la implementación divergió aquí.

- **Borrados:** `NodeElement`, `EdgeElement`, `ClusterElement`, `LabelEditor`, `SVGViewport`, `ModeBar`, `useEditorShortcuts`, `viewportManager`, `editOps`.
- **Reemplazos:** [ServiceNode.tsx](src/renderer/src/components/kinds/cloud/ServiceNode.tsx), [GroupNode.tsx](src/renderer/src/components/kinds/cloud/GroupNode.tsx), [NodeLabelInput.tsx](src/renderer/src/components/kinds/cloud/NodeLabelInput.tsx), y [CloudCanvas.tsx](src/renderer/src/components/kinds/cloud/CloudCanvas.tsx) (el componente central del editor).

### Componente central: CloudCanvas

[CloudCanvas.tsx](src/renderer/src/components/kinds/cloud/CloudCanvas.tsx) envuelve `<ReactFlow>` y gestiona:
- Conversión `LayoutResult` ↔ nodos/edges de React Flow ([toReactFlow.ts](src/renderer/src/core/layout/kinds/cloud/toReactFlow.ts)).
- **Crear** aristas (`onConnect`) y **reconectar** aristas existentes (`onReconnectStart`/`onReconnect`/`onReconnectEnd`; soltar en el vacío borra la arista).
- **Imán de alineación** al arrastrar nodos ([alignment.ts](src/renderer/src/core/layout/kinds/cloud/alignment.ts) + [AlignmentGuides.tsx](src/renderer/src/components/kinds/cloud/AlignmentGuides.tsx)): si el centro del nodo cae dentro de `SNAP_THRESHOLD` (8px) del centro de otro, engancha a esa línea recta y muestra guías punteadas. Los grupos no se enganchan.
- Edición inline de label (doble click → `data.editing` → `NodeLabelInput`).
- Sincronización al store (`syncToStore` → `updateLayoutWithReactFlow` → `updateLayout`).

### Detalles no obvios de React Flow

- **Coordenadas:** ELK da posiciones **absolutas**; React Flow usa posiciones **relativas al nodo padre** para anidación en clusters. Las conversiones restan/suman el offset del contenedor (ver `toReactFlow` y `alignment.ts`). Para comparar nodos de distintos clusters siempre se trabaja en absolutas.
- **Orden de nodos:** un hijo debe ir en el array *después* de su padre; los clusters se emiten ordenados por profundidad (ancestros primero).
- **`nodeTypes` se define fuera del componente** — React Flow exige referencia estable o re-renderiza todo.
- **Routing de aristas:** lo hace React Flow (`smoothstep`), **no** se reutilizan los bend points de ELK.
- **Snap al soltar:** React Flow emite un último cambio con la posición real del cursor (sin snap) al hacer `dragStop`. Por eso `onNodeDragStop` **reaplica** el imán sobre la posición final; si no, reaparece el efecto escalera.

## Iconos

- [icons/registry.ts](src/renderer/src/icons/registry.ts) genera **placeholders SVG** (badge con color+texto por tipo, ej. `aws/ec2`).
- [icons/officialIcons.ts](src/renderer/src/icons/officialIcons.ts) auto-descubre los **SVG oficiales** con `import.meta.glob`. `getIconDataUri()` prefiere el oficial sobre el placeholder.
- Hay **~307 iconos oficiales de AWS** en [icons/aws/](src/renderer/src/icons/aws/). `azure/`, `gcp/`, `kubernetes/`, `oss/` siguen como placeholders (solo `.gitkeep`).

## Convenciones

- **Comentarios y mensajes de commit en español.** Identificadores y términos técnicos en su forma original.
- Indentación de 2 espacios, sin punto y coma final (config de Prettier del repo). Correr `pnpm format` si hay dudas.
- Imports tipo: `import { type Foo }` o `import type { Foo }`.
- Ejemplos `.arch` de referencia en [resources/](resources/): `example.arch`, `aws-deployment.arch`, `enterprise-saas.arch` (71 nodos, 19 clusters, 98 edges — el caso grande).

## Estado actual y cabos sueltos

- El editor avanza por fases: F1+F2 (selección, modos, drag&drop), F3 (labels inline, eliminar, connect), luego la migración a React Flow + reconexión de aristas + imán de alineación.
- **`serializeCloud` ([serialize.ts](src/renderer/src/core/parser/kinds/cloud/serialize.ts)) está escrito pero no conectado.** Reconstruye el DSL `.arch` desde un `CloudGraph`, pero nada lo importa todavía. Cuidado: `App.tsx`/`handleSaveArchd` usa `def.serialize` → `serializeArchd` (escribe el `.archd` JSON), que es **otro** serializador. Guardar las ediciones visuales de vuelta al `.arch` aún está pendiente, y requeriría reconstruir el `model` (CloudGraph) desde el estado editado de React Flow (hoy `updateLayoutWithReactFlow` solo actualiza el `LayoutResult`, no el `model`).

## Verificación

No hay infraestructura E2E (ni Playwright ni driver de Electron). El `.arch` se abre con un diálogo nativo modal. Para verificar cambios de UI en runtime hay que lanzar `pnpm dev` y probar a mano; un build limpio no prueba comportamiento.
