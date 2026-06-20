---
name: escribir-bachi
description: Usar al escribir, generar o corregir archivos .bachi (el DSL de arquitectura cloud, estilo Mermaid architecture-beta). Contiene la gramática completa — header, servicios, grupos, aristas, labels y escapes. Invocar cuando el usuario pida "haz un diagrama de…", "genera un .bachi", "dibuja esta arquitectura" o cuando un .bachi dé error de sintaxis.
---

# Escribir un archivo `.bachi` — DSL cloud

El `.bachi` es la **fuente de verdad de la topología** (un agente o un humano lo
escribe; el diagrama aparece con hot reload). DSL declarativo, una sentencia por
línea. Gramática real del parser
([dslParser.ts](src/renderer/src/core/parser/kinds/cloud/dslParser.ts)).

## Estructura

```bachi
arch-cloud lr          # 1ª línea significativa: header obligatorio. lr | tb

service web(aws/ec2)[Servidor web]
service db(aws/rds)[Base de datos]

group backend [Backend]
service api(oss/server) in backend

web --> api
api --> db : consulta
```

## Sentencias

### Header (obligatorio, primero)
`arch-cloud <dir>` — `lr` (left→right) o `tb` (top→bottom). Comentarios `#` y
líneas en blanco antes del header se ignoran.

### Servicio
```
service <id>(<type>)[<label>] [in <grupo>]
```
- `<id>`: identificador único (sin espacios), se usa en las aristas.
- `<type>`: icono `proveedor/servicio` (ej. `aws/ec2`, `gcp/cloud-run`,
  `k8s/pod`, `oss/postgres`). El tipo es plano (no incluye categoría).
- `[<label>]`: texto visible (opcional). `in <grupo>` lo mete en un cluster.

### Grupo (cluster)
```
group <id> [<label>] [in <grupo_padre>]
```
Pueden anidarse con `in`. Los servicios se asignan con `in <grupo>`.

### Aristas
```
a --> b            # dirigida
a -.-> b            # punteada (dashed)
a <--> b            # bidireccional
a --> b --> c       # cadena (encadena varias)
a --> b : texto     # con label
a --> b : "con espacios"   # label con espacios → entre comillas
```

## Labels: escapes (importante)

Los labels admiten multilínea. Al serializar, se escapan; al parsear, se
desescapan ([serialize.ts](src/renderer/src/core/parser/kinds/cloud/serialize.ts)):

- Salto de línea real → `\n` literal dentro de `[...]` o `"..."`.
- Barra invertida → `\\`.
- Un label de arista necesita comillas si **no** es un identificador pelado
  (cualquier cosa con espacios, `\n` u otros símbolos va entre `"..."`).

No metas saltos de línea crudos dentro de `[...]`: rompen la sintaxis. Usa `\n`.

## Comentarios
`#` hasta fin de línea. Útil como cabecera (los ejemplos llevan 3 líneas de
ayuda al inicio).

## Buenas prácticas

- Ids cortos y estables (se referencian en las aristas y persisten en el `.bachid`).
- Declara grupos antes de sus servicios para legibilidad.
- Mira ejemplos en `resources/`: `example.bachi`, `aws-deployment.bachi`,
  `enterprise-saas.bachi` (caso grande: 71 nodos, 19 clusters, 98 edges).
- Tras escribir, el icono debe resolver a uno real; si sale un placeholder con
  texto, el `<type>` no existe (revisa nombre/alias — ver skill `iconos-proveedor`).
