---
name: nuevo-tipo-diagrama
description: Usar al añadir un nuevo tipo de diagrama (kind) a Bachi Draw — p.ej. BPMN, ERD, sequence, C4, state-machine. Describe el contrato DiagramKindDef, los archivos y carpetas a crear, los 3 puntos de registro (tipo, registry, dispatcher) y la regla de oro de no tocar otros kinds. Invocar cuando el usuario diga "añadir un tipo", "soportar diagramas X", "nuevo kind" o "arch-<algo>".
---

# Añadir un tipo de diagrama (kind) — Bachi Draw

La arquitectura es multi-tipo: hoy existen `cloud` y `pizarra`. Añadir uno nuevo
es **implementar una interfaz y registrarla en 3 sitios**.

> **Regla de oro:** añadir un kind NO debe requerir tocar el código de los demás
> kinds. Todo lo específico vive bajo `core/<capa>/kinds/<kind>/` y
> `components/kinds/<kind>/`.

## El contrato: `DiagramKindDef`

En [kind.ts](src/renderer/src/core/diagram/kind.ts). Un kind aporta:

| Campo | Qué hace |
|-------|----------|
| `kind` | id; coincide con el header `arch-<kind>` del archivo |
| `label` | etiqueta humana (UI/errores) |
| `parse(source)` | texto fuente → **modelo** de dominio (sin coordenadas) |
| `layout(model)` | modelo → **layout** con coordenadas absolutas (Promise) |
| `Canvas` | componente React que renderiza el layout (props en `CanvasProps`) |
| `getName(layout)` | nombre para la toolbar |
| `getBounds(layout)` | bounding box para fit-to-container |
| `getStats(layout)` | conteos para la barra de estado |
| `serialize(fileName, layout, canvas)` | → JSON persistible (`.bachid` o equivalente) |

El pipeline es: `detectKind` → `parse` → `layout` → (reconcile) → `Canvas`.

## Archivos a crear (ejemplo para `arch-bpmn`)

```
core/parser/kinds/bpmn/types.ts      # tipos del modelo y del layout
core/parser/kinds/bpmn/<parser>.ts   # parse(): source → modelo
core/layout/kinds/bpmn/<runner>.ts   # layout(): modelo → coords (elkjs si aplica)
core/state/kinds/bpmn/<serializer>.ts# serialize(): layout → JSON
components/kinds/bpmn/BpmnCanvas.tsx  # Canvas (envuelve <ReactFlow> u otro render)
resources/bpmn-example.bachi         # ejemplo mínimo de referencia
```

## Los 3 puntos de registro (sin esto el kind no existe)

1. **Tipo** — añade el id a la unión `DiagramKind` en
   [kind.ts](src/renderer/src/core/diagram/kind.ts):
   ```ts
   export type DiagramKind = 'cloud' | 'pizarra' | 'bpmn'
   ```
2. **Registry** — declara el `DiagramKindDef` y mételo en `KIND_REGISTRY` en
   [registry.ts](src/renderer/src/core/diagram/registry.ts) (mira `cloudKind`
   como plantilla).
3. **Dispatcher** — en [dispatcher.ts](src/renderer/src/core/diagram/dispatcher.ts),
   `detectKind` solo devuelve los kinds que reconoce explícitamente; añade tu
   `candidate`:
   ```ts
   if (candidate === 'cloud') return 'cloud'
   if (candidate === 'bpmn') return 'bpmn'
   ```

## Detalles que se olvidan

- **Coordenadas React Flow**: si reusas React Flow, ELK da posiciones absolutas
  pero React Flow las quiere relativas al padre. Mira `toReactFlow`/`alignment`
  del kind `cloud`.
- **`nodeTypes`/`edgeTypes` fuera del componente** (referencia estable).
- **No reencuadrar al editar**: el store usa `externalRev`; el `fitView` depende
  de él, no del `layout`. No llamar `setDiagram` desde una edición.
- **Reconciliación** (preservar posiciones del `.bachid`) es **específica de
  cloud** hoy. Un kind nuevo decide si la necesita; no la hereda gratis.

## Cierre

- Ejemplo en `resources/`, y **tests E2E** del nuevo kind (ver skill
  `verificar-cambio`). Valida con `pnpm typecheck` + `pnpm lint` + `pnpm test:e2e`.
