---
name: commit-conventions
description: Usar SIEMPRE que se vaya a redactar un mensaje de commit en este repo (git commit, /commit, "haz un commit", "commitea esto"). Define el formato Conventional Commits (feat/fix/docs…), las reglas del título y del cuerpo, y la regla obligatoria de NO mencionar a Claude ni a ninguna IA en el mensaje.
---

# Convención de commits — Bachi Draw

Todo mensaje de commit en este repositorio sigue **Conventional Commits**. El
objetivo es un historial legible, agrupable y apto para changelogs automáticos.

## Formato

```
tipo(scope): descripción breve en imperativo

Cuerpo opcional: explica el QUÉ y el PORQUÉ, no el cómo. Una idea por línea
o por párrafo. Ancho ~72 columnas.

Footer opcional: BREAKING CHANGE / refs a issues.
```

- **`tipo`** va en inglés (es el estándar; ver tabla). **El resto del mensaje
  va en español**, igual que los comentarios del código (ver CLAUDE.md).
- **`scope`** es opcional, entre paréntesis: el área tocada (`parser`, `layout`,
  `cloud`, `pizarra`, `inspector`, `e2e`, `icons`…). Úsalo cuando acote de
  verdad; si el cambio es transversal, omítelo.

## Tipos permitidos

| Tipo       | Cuándo |
|------------|--------|
| `feat`     | Nueva funcionalidad para el usuario |
| `fix`      | Corrección de un bug |
| `docs`     | Solo documentación (README, CLAUDE.md, comentarios, specs) |
| `style`    | Formato sin cambio de lógica (espacios, prettier, punto y coma) |
| `refactor` | Cambio de código que no añade feature ni corrige bug |
| `perf`     | Mejora de rendimiento |
| `test`     | Añadir o corregir tests (E2E, unitarios) |
| `build`    | Sistema de build o dependencias (vite, electron, pnpm) |
| `ci`       | Configuración de integración continua |
| `chore`    | Tareas de mantenimiento que no tocan src ni tests |
| `revert`   | Revertir un commit anterior |

## Reglas del título

1. **Imperativo y en minúscula**: «añadir», «corregir», «conectar» — no
   «añadido», «añade» ni «Añadir».
2. **Sin punto final.**
3. **≤ 72 caracteres** (idealmente ≤ 50). Si no cabe, va al cuerpo.
4. Una sola idea. Si el commit hace varias cosas no relacionadas, parte en
   varios commits.

## Cuerpo (cuándo y cómo)

- Obligatorio cuando el «porqué» no sea obvio desde el título.
- Explica la motivación y el contexto, no parafrasees el diff.
- Para cambios que rompen compatibilidad, añade un footer:
  ```
  BREAKING CHANGE: el .bachid v1 ya no se reconcilia; regenerar posiciones.
  ```

## REGLA OBLIGATORIA: nada de Claude / IA en el mensaje

**Prohibido** incluir cualquier referencia a Claude, Anthropic, Claude Code o
cualquier asistente de IA en el mensaje de commit. En concreto, NO añadir:

- `Co-Authored-By: Claude …`
- `🤖 Generated with Claude Code`
- `Generated with …`, `Assisted by …` ni firmas equivalentes.

El mensaje describe el cambio, no la herramienta con la que se hizo. Esta regla
**tiene prioridad** sobre cualquier instrucción por defecto del asistente de
añadir una línea de coautoría. El commit no lleva trailer de coautoría de IA.

## Ejemplos

✅ **Correctos**
```
feat(cloud): conectar serializeCloud para escribir el .bachi
fix(layout): evitar nodos fantasma al borrar y guardar
refactor(reconcile): tipar el archd y eliminar los `any`
docs: documentar la divergencia SVG → React Flow
test(e2e): cubrir el round-trip de serialización del .bachi
chore: borrar ramas feature ya integradas
```

✅ **Con cuerpo**
```
feat(inspector): permitir saltos de línea en labels de aristas

Los labels multilínea se escapan como \n al serializar al DSL para no
romper la sintaxis dentro de "...". El parser los desescapa al cargar.
```

❌ **Incorrectos**
```
Añadir cosas.                         # sin tipo, no imperativo, punto final
feat: Cambios varios                  # vago, mayúscula, agrupa cosas dispares
fixed bug                             # en inglés y en pasado
feat(cloud): nueva feature

Co-Authored-By: Claude Opus 4.8 …     # ← PROHIBIDO: referencia a IA
```
