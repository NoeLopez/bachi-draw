---
name: iconos-proveedor
description: Usar al añadir o ampliar iconos de un proveedor en Bachi Draw (AWS, GCP, Azure, Kubernetes/k8s, OSS). Explica dónde colocar los SVG, cómo se forma el tipo lógico (plano, ignora la categoría), el auto-descubrimiento por glob, los aliases y las trampas de Vite. Invocar cuando el usuario diga "añadir iconos de Azure/GCP/K8s", "faltan iconos de X", "meter el set de iconos" o "el panel de figuras no muestra Y".
---

# Añadir iconos de un proveedor — Bachi Draw

Los iconos se **auto-descubren**: no hay que registrar cada uno a mano. El motor
está en [officialIcons.ts](src/renderer/src/icons/officialIcons.ts) y usa
`import.meta.glob` en build-time.

## Dónde van los archivos

```
src/renderer/src/icons/<provider>/<categoria>/<servicio>.svg
```

Proveedores existentes: `aws`, `gcp`, `azure`, `kubernetes`, `oss`.

- Ej.: `icons/azure/compute/virtual-machines.svg`
- El **tipo lógico es PLANO**: `azure/virtual-machines` — **la categoría NO entra
  en el tipo**, es solo metadato para agrupar el panel de figuras
  (`getIconCategory`). Así los `.bachi` no dependen de la categoría.

### Sub-carpetas con significado especial (conservan el path en el tipo)

| Carpeta | Tipo resultante | Uso |
|---------|-----------------|-----|
| `groups/` | `<prov>/groups/<x>` | bordes de cluster (ej. `aws/groups/vpc`) |
| `legacy/` | `<prov>/legacy/<x>` | variantes legacy (ej. `gcp/legacy/cloud-run`) |
| `shapes/` | `<prov>/shapes/<x>` | figuras geométricas (ej. `oss/shapes/rectangle`) |

## Lo que normalmente NO hay que tocar

`officialIcons.ts` detecta los `.svg` solo. **No edites el glob ni el map** al
añadir archivos. Solo lo editas para:

- **Aliases de servicio** (`SERVICE_ALIASES`): cuando el `.bachi` use un acrónimo
  distinto del nombre de archivo (ej. `alb` → `elastic-load-balancing`).
- **Alias de proveedor** (`PROVIDER_ALIASES`): ya existe `k8s` → `kubernetes`.

## Resolución de un tipo (orden)

`getOfficialIconUrl(type)`: 1) match directo → 2) alias de servicio dentro del
proveedor → 3) alias de proveedor. Si nada coincide, cae al **placeholder** del
[registry.ts](src/renderer/src/icons/registry.ts) (badge con color+texto).

## Trampas de Vite (no te asustes)

- Los SVG **< 4 KB se inlinean** como data-uri (no generan archivo en `out/`);
  los mayores salen como archivo hasheado. **Contar `.svg` en `out/` engaña** —
  ambas formas son válidas y todos los tipos están en el map.
- Por eso, para verificar cobertura **no cuentes archivos**: usa
  `listOfficialIconTypes()` o mira el panel de figuras en la app corriendo.

## Checklist

1. Volcar los SVG en `icons/<provider>/<categoria>/`.
2. ¿El `.bachi` usará acrónimos? Añade entradas a `SERVICE_ALIASES[provider]`.
3. `pnpm dev` y comprueba el panel de figuras (buscador + categorías).
4. Un `.bachi` de prueba con `service x(<provider>/<servicio>)[…]` debe mostrar el
   icono real, no el placeholder.
5. `pnpm typecheck` + `pnpm lint` (ver skill `verificar-cambio`).
