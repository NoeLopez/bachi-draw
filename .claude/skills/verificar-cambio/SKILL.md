---
name: verificar-cambio
description: Usar tras CUALQUIER edición de código en Bachi Draw (renderer, main o preload) antes de darla por terminada o commitearla. Define el orden de validación obligatorio — typecheck, lint, formato y tests E2E — y qué hacer cuando algo falla. Invocar cuando el usuario pida "verifica", "valida el cambio", "¿pasa el typecheck?", o al cerrar una tarea de código.
---

# Verificar un cambio — Bachi Draw

Ningún cambio de código se considera terminado hasta pasar esta verificación.
El orden va de lo más rápido/barato a lo más lento, para fallar pronto.

## 1. Typecheck (lo primero, siempre)

```bash
pnpm typecheck:web    # solo el renderer — lo más rápido durante iteración de UI
```

Si tocaste `main/` o `preload/` (Node), corre el completo:

```bash
pnpm typecheck        # typecheck:node + typecheck:web
```

## 2. Lint y formato (sobre los archivos tocados)

```bash
npx eslint <archivo>              # rápido, solo lo editado
npx prettier --write <archivo>    # 2 espacios, sin punto y coma (config del repo)
```

Antes de commitear, conviene el lint completo: `pnpm lint` (debe quedar en
**0 problemas** — el repo no tolera `any` ni warnings).

## 3. Tests E2E (Playwright + Electron)

**Regla del proyecto: E2E por cada cambio, iterar hasta verde.** No se commitea
hasta que el usuario lo pida tras revisar.

**Corre SOLO los specs del área que tocaste — no toda la suite.** La suite
completa son ~5–6 min; un spec aislado, ~40 s. Correr pizarra por un cambio de
cloud es desperdicio.

Los E2E se ejecutan sobre la app **compilada** en `out/`. Flujo eficiente:

```bash
electron-vite build                                # 1) recompila UNA vez tras editar
pnpm test:e2e:run e2e/cloud-serialize.spec.ts      # 2) solo el/los spec(s) afectados
```

Si solo cambian los tests (no el código fuente), puedes repetir el paso 2 sin
recompilar. `pnpm test:e2e` (build + suite completa) se reserva para **antes de
commitear** o para cambios transversales (`App.tsx`, store, theme).

### Qué spec corresponde a cada área

| Tocaste… | Specs a correr |
|----------|----------------|
| Canvas cloud, aristas, nodos, serialización | `cloud-serialize.spec.ts` |
| Editor de código `.bachi` | `cloud-code-editor.spec.ts` |
| Pizarra / Excalidraw | `pizarra.spec.ts` |
| Modo presentación | `presentation.spec.ts` |
| Atajos de teclado | `shortcuts.spec.ts` |
| Chrome/UI general, temas, paneles | `ui-chrome.spec.ts` |
| Transversal (App, store, theme) | la suite completa (`pnpm test:e2e`) |

Si tu cambio afecta una zona sin cobertura, **añade el test** antes de cerrar.

## Si algo falla

- **No silenciar**: nada de `eslint-disable`, `@ts-ignore` ni `as any` para tapar
  un error. Tiparlo bien (ver cómo se resolvió el `.bachid` con `ReconcileSource`).
- **Reportar fielmente**: si un test queda rojo, decirlo con la salida; no
  declarar "hecho" sobre una verificación que no pasó.
- Iterar hasta que typecheck, lint y E2E estén en verde.

## Atajo mental

`typecheck:web` → `eslint`/`prettier` del archivo → `test:e2e` → (al cerrar)
`pnpm lint` + `pnpm typecheck` completos. Verde en todo = listo para que el
usuario revise y decida el commit (ver skill `commit-conventions`).
