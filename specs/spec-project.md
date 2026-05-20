# Software Design Document (SDD)

## Diagen — AI-Native Architecture Diagram Tool

### MVP v1.0

---

## Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Contexto y Problema](#2-contexto-y-problema)
3. [Objetivos del MVP](#3-objetivos-del-mvp)
4. [Alcance del MVP](#4-alcance-del-mvp)
5. [Arquitectura del Sistema](#5-arquitectura-del-sistema)
6. [Stack Tecnológico](#6-stack-tecnológico)
7. [Estructura del Proyecto](#7-estructura-del-proyecto)
8. [Formato de Archivo `.arch`](#8-formato-de-archivo-arch)
9. [Formato de Archivo `.archd`](#9-formato-de-archivo-archd)
10. [Pipeline de Renderizado](#10-pipeline-de-renderizado)
11. [Motor de Layout — elkjs](#11-motor-de-layout--elkjs)
12. [Sistema de Iconos Oficiales](#12-sistema-de-iconos-oficiales)
13. [File Watcher y Hot Reload](#13-file-watcher-y-hot-reload)
14. [Arquitectura Electron](#14-arquitectura-electron)
15. [Componentes React](#15-componentes-react)
16. [Caso de Prueba Benchmark](#16-caso-de-prueba-benchmark)
17. [Fuera de Alcance MVP](#17-fuera-de-alcance-mvp)
18. [Decisiones de Diseño y Justificaciones](#18-decisiones-de-diseño-y-justificaciones)
19. [Evolución Futura](#19-evolución-futura)
20. [Arquitectura Multi-Tipo](#20-arquitectura-multi-tipo)

---

## 1. Visión General

**Diagen** es una herramienta de escritorio local diseñada desde cero para trabajar con agentes de IA como Claude Code. Permite generar y visualizar diagramas de arquitectura de software y cloud a partir de archivos de texto simples, con hot reload en tiempo real, iconos oficiales de proveedores (AWS, GCP, Azure, OSS), y un layout engine inteligente que elimina los problemas de flechas cruzadas, nodos superpuestos y texto mal posicionado que afectan a herramientas como DrawIO cuando son usadas por IA.

**Propuesta de valor única:** La única herramienta donde un agente de IA escribe un archivo de texto y el diagrama aparece instantáneamente con iconos oficiales y layout perfecto, sin coordenadas manuales ni XML frágil.

---

## 2. Contexto y Problema

### 2.1 Problema con herramientas existentes

Las herramientas actuales de diagramas no fueron diseñadas para ser generadas por IA:

| Herramienta       | Problema con IA                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------ |
| DrawIO            | XML posicional frágil, coordenadas absolutas, flechas sin garantía de conexión correcta    |
| Lucidchart        | SaaS propietario, sin API pública para generación programática                             |
| diagrams (Python) | Graphviz como motor (años 90), flechas que no conectan correctamente con clusters anidados |
| D2 / Mermaid      | Sin iconos oficiales de proveedores cloud                                                  |
| Terrastruct       | SaaS de pago, sin integración con agentes locales                                          |

### 2.2 Problema específico identificado

Al usar la librería `diagrams` de Python con arquitecturas que contienen:

- Clusters anidados (grupos como VPC, Servicios, Workers)
- Flechas con labels (publish, consume)
- Flechas que cruzan entre clusters
- Iconos mixtos (cloud + OSS)

El motor Graphviz calcula posiciones incorrectas: las flechas no terminan en el borde del ícono, los textos se superponen, y las conexiones apuntan a coordenadas vacías.

### 2.3 Gap en el mercado

No existe a la fecha (Mayo 2026) una herramienta que combine:

- Motor de layout moderno e inteligente
- Iconos oficiales de proveedores
- Formato de entrada amigable para IA
- Hot reload local
- Aplicación de escritorio nativa

---

## 3. Objetivos del MVP

1. **Formato legible para IA** — Claude Code puede generar y editar el archivo `.arch` (DSL Mermaid-style) sin conocer coordenadas ni IDs internos
2. **Layout automático correcto** — Flechas que conectan exactamente donde deben, sin cruces innecesarios, clusters bien delimitados
3. **Iconos oficiales** — AWS, GCP, Azure y tecnologías OSS comunes (Nginx, Postgres, Redis, Prometheus, Grafana, Kafka, etc.)
4. **Hot reload en tiempo real** — El diagrama se actualiza en menos de 500ms desde que Claude Code guarda el archivo
5. **Aplicación de escritorio** — Experiencia de app real, no un localhost en el browser
6. **Sin dependencias externas en runtime** — No requiere Java, Python, ni Docker para correr

---

## 4. Alcance del MVP

### Incluido

- Abrir y monitorear un archivo `.arch` (DSL `arch-cloud`)
- Parsear el DSL y transformarlo al formato elkjs
- Calcular layout con elkjs (algoritmo `layered`)
- Renderizar el diagrama como SVG en el canvas
- Mostrar iconos oficiales de: AWS, GCP, Azure, Kubernetes, y OSS (Nginx, Postgres, Redis, Prometheus, Grafana, Kafka, RabbitMQ, MongoDB)
- Soporte de clusters / grupos con label
- Soporte de labels en flechas (edges)
- Soporte de dirección del diagrama: LR (left-right), TB (top-bottom)
- Hot reload automático al detectar cambios en el archivo
- Guardar estado con posiciones en `.archd` (JSON)
- Zoom in/out con rueda del mouse
- Pan (arrastrar el canvas)
- Ventana de app desktop con Electron

### No incluido en MVP

- Edición visual de nodos (drag & drop)
- Múltiples archivos o tabs
- Export a PNG, PDF o SVG
- Temas de color por proveedor (el toggle dark/light sí está incluido)
- Colaboración o sync en la nube
- ELK Java como motor alternativo
- Iconos de Azure DevOps, Alibaba Cloud u otros proveedores adicionales
- Undo/Redo
- Búsqueda de nodos

---

## 5. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    Aplicación Electron                       │
│                                                             │
│  ┌──────────────────────┐    ┌──────────────────────────┐  │
│  │    Main Process      │    │    Renderer Process      │  │
│  │    (Node.js)         │    │    (React + TypeScript)  │  │
│  │                      │    │                          │  │
│  │  ┌────────────────┐  │    │  ┌────────────────────┐  │  │
│  │  │   Chokidar     │  │    │  │   DiagramCanvas    │  │  │
│  │  │  File Watcher  │──┼────┼─▶│   (SVG Renderer)   │  │  │
│  │  └────────────────┘  │    │  └────────────────────┘  │  │
│  │                      │    │           │               │  │
│  │  ┌────────────────┐  │    │  ┌────────────────────┐  │  │
│  │  │  IPC Bridge    │  │    │  │    elkjs Layout     │  │  │
│  │  │  (ipcMain)     │  │    │  │    Engine          │  │  │
│  │  └────────────────┘  │    │  └────────────────────┘  │  │
│  │                      │    │           │               │  │
│  └──────────────────────┘    │  ┌────────────────────┐  │  │
│                               │  │   Icon Registry    │  │  │
│                               │  │   (SVG Assets)     │  │  │
│                               │  └────────────────────┘  │  │
│                               └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         ▲                                    ▲
         │                                    │
  ┌──────┴──────┐                    ┌────────┴────────┐
  │ archivo     │                    │  Claude Code /  │
  │ .arch       │                    │  cualquier      │
  │ (DSL)       │                    │  agente IA      │
  └─────────────┘                    └─────────────────┘
```

### Flujo de datos completo

```
 1. Claude Code escribe/edita archivo.arch (DSL arch-cloud)
 2. Chokidar detecta cambio en filesystem (< 50ms)
 3. Main Process lee el archivo y lo envía via ipcMain
 4. Renderer Process recibe el contenido del DSL
 5. Dispatcher detecta el tipo de diagrama (arch-<kind>) y enruta
 6. DslParser (kinds/cloud) transforma a estructura interna CloudGraph
 7. ELKTransformer convierte CloudGraph al formato JSON de elkjs
 8. elkjs.layout() calcula posiciones x,y de nodos y rutas de flechas
 9. SVGRenderer (CloudCanvas) genera el SVG con posiciones + iconos
10. App actualiza el DOM — el usuario ve el cambio
11. StateManager guarda el resultado en .archd (JSON, regenerable)
```

---

## 6. Stack Tecnológico

| Capa          | Tecnología     | Versión | Justificación                                                                                                                      |
| ------------- | -------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Shell Desktop | **Electron**   | ^39.x   | Cross-platform, consistencia de rendering, mismo stack que DrawIO desktop, Claude Code puede construirlo completamente             |
| Build Tool    | **Vite**       | ^7.x    | Hot reload de desarrollo rápido, integración nativa con Electron via `electron-vite`                                               |
| UI Framework  | **React**      | ^19.x   | Ecosistema maduro, Claude Code lo genera con precisión                                                                             |
| Lenguaje      | **TypeScript** | ^5.x    | Type safety, mejor DX, previene errores en transformaciones de datos                                                               |
| Layout Engine | **elkjs**      | ^0.11.x | Motor moderno (Universidad de Kiel), algoritmos superiores a Graphviz, soporte nativo de clusters, sincronizado con ELK Java       |
| File Watcher  | **Chokidar**   | ^5.x    | Estándar de Node.js, usado internamente por Vite, confiable en todos los OS                                                        |
| DSL Parser    | **propio**     | —       | Lexer + recursive-descent parser sin dependencias. Sintaxis Mermaid-style con extensiones (chains, labels, dashed). Ver §8 y §18.7 |
| Renderizado   | **SVG nativo** | —       | Suficiente para MVP, editable via DOM, escalable sin pérdida de calidad                                                            |
| Iconos        | **SVG Assets** | —       | Packs oficiales de AWS, GCP, Azure, K8s + OSS empaquetados en la app                                                               |

### Por qué Electron sobre Tauri

Tauri usa el WebView nativo del sistema operativo (WebKit en Mac, WebKitGTK en Linux, Edge en Windows), lo que introduce inconsistencias de rendering entre plataformas para un editor visual complejo. Electron bundlea Chromium, garantizando comportamiento idéntico. DrawIO Desktop usa Electron por la misma razón. Para un MVP donde el foco es corrección del rendering SVG, Electron es la elección pragmática. Tauri puede evaluarse para versiones futuras una vez que el rendering sea estable.

### Por qué elkjs sobre Graphviz

Graphviz (motor de `diagrams` Python) fue diseñado en los años 90 para grafos de texto, no para diagramas de arquitectura con clusters anidados e iconos de tamaño variable. ELK fue diseñado específicamente para diagramas de software con jerarquía, y su algoritmo `layered` produce layouts significativamente mejores para el caso de uso de arquitecturas cloud con grupos y clusters.

---

## 7. Estructura del Proyecto

```
Diagen/
├── electron.vite.config.ts          # Configuración de electron-vite
├── package.json
├── tsconfig.json
│
├── src/
│   ├── main/                        # Electron Main Process (Node.js)
│   │   ├── index.ts                 # Entry point, crea BrowserWindow
│   │   ├── fileWatcher.ts           # Chokidar watcher, emite eventos IPC
│   │   ├── ipcHandlers.ts           # Registra handlers ipcMain
│   │   └── fileManager.ts           # Lectura/escritura de .arch y .archd
│   │
│   ├── preload/                     # Electron Preload Script
│   │   └── index.ts                 # Expone API segura al renderer via contextBridge
│   │
│   └── renderer/                    # Renderer Process (React)
│       ├── index.html
│       ├── main.tsx                 # Entry point React
│       │
│       ├── components/
│       │   ├── shared/              # Compartidos entre tipos de diagrama
│       │   │   ├── SVGViewport.tsx  # Wrapper con zoom + pan
│       │   │   ├── Toolbar.tsx      # Controles de zoom, abrir archivo, tema
│       │   │   ├── StatusBar.tsx    # Stats genéricos del diagrama
│       │   │   └── EmptyState.tsx   # Pantalla "abre un .arch"
│       │   │
│       │   └── kinds/cloud/         # Componentes específicos de arch-cloud
│       │       ├── CloudCanvas.tsx  # Canvas del tipo cloud (implementa CanvasProps)
│       │       ├── NodeElement.tsx  # Ícono + label del nodo
│       │       ├── EdgeElement.tsx  # Flecha + label, esquinas redondeadas
│       │       └── ClusterElement.tsx # Borde dashed + label del cluster
│       │
│       ├── core/
│       │   ├── diagram/             # Sistema multi-tipo (ver §20)
│       │   │   ├── kind.ts          # DiagramKind, DiagramKindDef, CanvasProps
│       │   │   ├── dispatcher.ts    # detectKind() lee header arch-<kind>
│       │   │   └── registry.ts      # Registro de tipos disponibles
│       │   │
│       │   ├── parser/
│       │   │   ├── common/
│       │   │   │   └── lexer.ts     # Tokenizer reusable con posición línea/col
│       │   │   └── kinds/cloud/
│       │   │       ├── dslParser.ts # Recursive descent → CloudGraph
│       │   │       └── types.ts     # CloudGraph, CloudNode, CloudEdge, CloudCluster
│       │   │
│       │   ├── layout/
│       │   │   └── kinds/cloud/
│       │   │       ├── transformer.ts # CloudGraph → formato JSON elkjs
│       │   │       └── runner.ts      # Ejecuta elk.layout(), aplana coords
│       │   │
│       │   ├── renderer/
│       │   │   └── viewportManager.ts # Zoom, pan, fit-to-container
│       │   │
│       │   ├── state/
│       │   │   └── kinds/cloud/
│       │   │       └── archdSerializer.ts # LayoutResult → .archd JSON
│       │   │
│       │   └── theme/
│       │       └── useTheme.ts      # Toggle dark/light + persistencia
│       │
│       └── icons/
│           ├── registry.ts          # Map de tipo → SVG (placeholders fallback)
│           ├── officialIcons.ts     # Auto-discovery de SVGs oficiales con import.meta.glob
│           ├── aws/                 # SVGs oficiales AWS
│           ├── gcp/                 # SVGs oficiales GCP
│           ├── azure/               # SVGs oficiales Azure
│           ├── kubernetes/          # SVGs oficiales K8s
│           └── oss/                 # SVGs OSS (Nginx, Postgres, Redis, etc.)
│
└── assets/
    └── icons/                       # Fuente de los SVG antes de ser procesados
```

---

## 8. Formato de Archivo `.arch`

El `.arch` es un **DSL declarativo inspirado en Mermaid `architecture-beta`**. Cada archivo declara su tipo de diagrama en la primera línea (`arch-cloud` para arquitecturas cloud; en el futuro `arch-bpmn`, `arch-sequence`, etc. — ver §20). El formato está diseñado para ser:

- Escrito por IA sin conocer coordenadas
- Sin sensibilidad a indentación (a diferencia de YAML)
- Mínimo en tokens (≈60% menos que YAML equivalente)
- Familiar para la IA (Mermaid está en su training data)
- Legible y editable por humanos
- Separado del estado de la aplicación (posiciones, zoom, etc.)

### 8.1 Gramática `arch-cloud` (EBNF)

```ebnf
document   = header , { line } ;

header     = "arch-cloud" , [ direction ] , NEWLINE ;
direction  = "lr" | "tb" ;                    (* default: lr *)

line       = group | service | edgeStmt | NEWLINE ;

group      = "group" , IDENT , [ category ] , [ bracketLabel ] ,
             [ membership ] , NEWLINE ;
service    = "service" , IDENT , [ category ] , [ bracketLabel ] ,
             [ membership ] , NEWLINE ;
category   = "(" , IDENT , ")" ;              (* tipo del nodo en service;
                                                 ignorada por ahora en group *)
bracketLabel = "[" , RAW , "]" ;              (* RAW = cualquier carácter
                                                 excepto ']' y '\n' *)
membership = "in" , IDENT ;                   (* cluster padre *)

edgeStmt   = IDENT , arrow , IDENT , { arrow , IDENT } ,
             [ ":" , labelText ] , NEWLINE ;
arrow      = "-->" | "-.->" | "<-->" ;        (* solid · dashed · bidir *)
labelText  = IDENT | STRING | IDENT { IDENT } ;

IDENT      = ( letter | "_" ) , { letter | digit | "_" | "-" | "/" | "." } ;
STRING     = '"' , { any char except '"' or '\n' } , '"' ;
COMMENT    = "#" ... NEWLINE                   (* consumido por el lexer *)
```

**Reglas clave**:

- El header `arch-cloud` es **obligatorio** y debe ser la primera línea no vacía/comentario.
- La dirección es **opcional**: `arch-cloud` (default `lr`), `arch-cloud lr`, `arch-cloud tb`.
- Los IDs siguen `snake_case` o `kebab-case`. Los **tipos** de service (ej. `aws/alb`) pueden incluir `/` y `.` (ver §8.3).
- Los labels entre `[...]` son **texto raw** — admiten espacios, unicode, em-dash, CIDR notation, etc., sin necesidad de comillas. Solo `]` y newline los terminan.
- Los labels de edge entre comillas (`: "static assets"`) se requieren cuando incluyen espacios. Una sola palabra puede ir sin comillas (`: HTTPS`).
- **Chains**: `a --> b --> c --> d` se expande a 3 edges (`a→b`, `b→c`, `c→d`). Si hay un label al final del chain, aplica solo al último segmento.
- **Comentarios**: `# texto hasta fin de línea`. Permitidos en cualquier lugar.
- **IDs únicos**: un mismo ID no puede aparecer dos veces (ya sea como `group` o `service`).
- **Referencias**: cualquier ID usado en `in <parent>` o en una arista debe haber sido declarado antes en el archivo.

### 8.2 Ejemplo real — Arquitectura de Microservicios

Caso de prueba benchmark. Comparado con el equivalente YAML anterior (~105 líneas), el DSL queda en ~49 líneas:

```
arch-cloud lr

service clientes(oss/users)[clientes]
service api_gateway(oss/nginx)[api gateway]
service eventos(oss/kafka)[eventos]

group servicios [Servicios]
service auth(oss/server) in servicios
service orders(oss/server) in servicios
service payments(oss/server) in servicios

group workers [Workers]
service worker1(oss/server) in workers
service worker2(oss/server) in workers

group datos [Datos]
service postgres(oss/postgres) in datos
service redis(oss/redis) in datos

group observabilidad [Observabilidad]
service prometheus(oss/prometheus) in observabilidad
service grafana(oss/grafana) in observabilidad

clientes --> api_gateway
api_gateway --> auth
api_gateway --> orders
api_gateway --> payments
auth -.-> eventos : publish
orders --> eventos : publish
payments --> eventos : publish
eventos --> worker1 : consume
eventos --> worker2 : consume
worker1 --> postgres
worker2 --> postgres
orders --> postgres
payments --> postgres
orders --> redis
payments --> redis
worker1 -.-> prometheus
prometheus --> grafana
```

### 8.2.1 Header para que la IA infiera la gramática

Para que un agente pueda generar `.arch` sin un system prompt explícito, cada archivo lleva una primera línea de comentario con la gramática mínima. La IA aprende todo lo que necesita del propio archivo:

```
# arch-cloud v1 · header: "arch-cloud [lr|tb]" · group <id>[<label>] [in <parent>] ·
# service <id>(<type>)[<label>] [in <parent>] · edges: a-->b · a -.->b (dashed) ·
# a<-->b (bidir) · chains: a-->b-->c · label: ": texto" · # comentarios
arch-cloud lr
...
```

~80 tokens fijos para "instalar el lenguaje" en cada conversación, sin requerir prompts auxiliares.

### 8.3 Tipos de iconos soportados en MVP

#### AWS

| type              | Descripción               |
| ----------------- | ------------------------- |
| `aws/alb`         | Application Load Balancer |
| `aws/ec2`         | EC2 Instance              |
| `aws/ecs`         | ECS / Fargate             |
| `aws/lambda`      | Lambda Function           |
| `aws/rds`         | RDS                       |
| `aws/aurora`      | Aurora                    |
| `aws/s3`          | S3 Bucket                 |
| `aws/cloudfront`  | CloudFront                |
| `aws/route53`     | Route 53                  |
| `aws/vpc`         | VPC                       |
| `aws/sqs`         | SQS                       |
| `aws/sns`         | SNS                       |
| `aws/elasticache` | ElastiCache               |
| `aws/apigateway`  | API Gateway               |
| `aws/cognito`     | Cognito                   |
| `aws/iam`         | IAM                       |

#### GCP

| type               | Descripción              |
| ------------------ | ------------------------ |
| `gcp/gke`          | Google Kubernetes Engine |
| `gcp/cloudsql`     | Cloud SQL                |
| `gcp/gcs`          | Cloud Storage            |
| `gcp/cloudrun`     | Cloud Run                |
| `gcp/pubsub`       | Pub/Sub                  |
| `gcp/bigquery`     | BigQuery                 |
| `gcp/loadbalancer` | Load Balancing           |

#### Azure

| type               | Descripción              |
| ------------------ | ------------------------ |
| `azure/aks`        | Azure Kubernetes Service |
| `azure/appservice` | App Service              |
| `azure/sql`        | Azure SQL                |
| `azure/blob`       | Blob Storage             |
| `azure/servicebus` | Service Bus              |
| `azure/functions`  | Azure Functions          |

#### Kubernetes

| type             | Descripción |
| ---------------- | ----------- |
| `k8s/pod`        | Pod         |
| `k8s/deployment` | Deployment  |
| `k8s/service`    | Service     |
| `k8s/ingress`    | Ingress     |
| `k8s/configmap`  | ConfigMap   |
| `k8s/namespace`  | Namespace   |

#### OSS (Open Source)

| type                | Descripción         |
| ------------------- | ------------------- |
| `oss/nginx`         | Nginx               |
| `oss/postgres`      | PostgreSQL          |
| `oss/redis`         | Redis               |
| `oss/kafka`         | Apache Kafka        |
| `oss/rabbitmq`      | RabbitMQ            |
| `oss/mongodb`       | MongoDB             |
| `oss/prometheus`    | Prometheus          |
| `oss/grafana`       | Grafana             |
| `oss/elasticsearch` | Elasticsearch       |
| `oss/server`        | Servidor genérico   |
| `oss/users`         | Usuarios / Clientes |
| `oss/browser`       | Browser             |
| `oss/mobile`        | Mobile App          |

---

## 9. Formato de Archivo `.archd`

El archivo `.archd` es el formato de documento guardado. Lo escribe y lee la aplicación. Contiene toda la información necesaria para restaurar el estado visual exacto del diagrama, incluyendo posiciones calculadas por elkjs o ajustadas manualmente en el futuro.

**Regla importante:** El archivo `.arch` (DSL) es la fuente de verdad de la topología. El `.archd` es el estado visual derivado y regenerable. Si existe un `.archd` para el `.arch` abierto, la app usa las posiciones del `.archd`. Si no existe, calcula el layout desde cero con elkjs.

```json
{
  "version": "1.0",
  "source": "arquitectura-microservicios.arch",
  "generatedAt": "2026-05-18T21:00:00Z",
  "canvas": {
    "zoom": 1.0,
    "offsetX": 0,
    "offsetY": 0,
    "width": 1440,
    "height": 900
  },
  "nodes": [
    {
      "id": "clientes",
      "type": "oss/users",
      "label": "clientes",
      "x": 40,
      "y": 320,
      "width": 80,
      "height": 80
    }
  ],
  "clusters": [
    {
      "id": "servicios",
      "label": "Servicios",
      "x": 280,
      "y": 180,
      "width": 200,
      "height": 380
    }
  ],
  "edges": [
    {
      "id": "e_clientes_api_gateway",
      "from": "clientes",
      "to": "api_gateway",
      "label": null,
      "style": "solid",
      "points": [
        { "x": 120, "y": 360 },
        { "x": 200, "y": 360 }
      ]
    }
  ]
}
```

---

## 10. Pipeline de Renderizado

### 10.1 Transformación DSL → CloudGraph

El parser del DSL (recursive descent, sin librerías externas) emite el modelo de dominio `CloudGraph`. El lexer está en `core/parser/common/lexer.ts` y es reusable por otros tipos de diagrama. El parser específico vive en `core/parser/kinds/cloud/dslParser.ts`.

```typescript
// core/parser/kinds/cloud/types.ts
interface CloudNode {
  id: string
  type: string
  label: string
  clusterId?: string // ID del cluster padre, si aplica
}

interface CloudEdge {
  id: string
  from: string
  to: string
  label?: string
  style: 'solid' | 'dashed'
  direction: 'forward' | 'back' | 'both'
}

interface CloudCluster {
  id: string
  label: string
  nodeIds: string[]
  childClusterIds: string[]
  parentClusterId?: string
}

interface CloudGraph {
  name: string
  direction: 'LR' | 'TB'
  nodes: CloudNode[]
  edges: CloudEdge[]
  clusters: CloudCluster[]
}
```

### 10.2 Transformación CloudGraph → formato elkjs

elkjs espera un grafo JSON con `children` (nodos) y `edges`. Los clusters se representan como nodos con sus propios `children`.

```typescript
// core/layout/kinds/cloud/transformer.ts — lógica de transformación

function toElkGraph(graph: CloudGraph): ElkNode {
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': graph.direction === 'LR' ? 'RIGHT' : 'DOWN',
      'elk.layered.spacing.nodeNodeBetweenLayers': '30',
      'elk.spacing.nodeNode': '10',
      'elk.padding': '[top=10,left=10,bottom=10,right=10]',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN'
    },
    children: buildChildren(graph),
    edges: buildEdges(graph)
  }
}
```

**Consideración crítica:** Las flechas que cruzan entre clusters deben declararse a nivel del nodo raíz en elkjs, no dentro del cluster. El `ELKTransformer` es responsable de detectar estas flechas inter-cluster y elevarlas al nivel correcto.

### 10.3 Renderizado SVG

El SVG se genera con las posiciones calculadas por elkjs. Cada elemento es un componente React que recibe sus coordenadas como props:

```
<svg viewBox="0 0 {width} {height}">
  <!-- Primero clusters (fondo) -->
  {clusters.map(c => <ClusterElement key={c.id} cluster={c} />)}

  <!-- Luego edges (sobre clusters, bajo nodos) -->
  {edges.map(e => <EdgeElement key={e.id} edge={e} />)}

  <!-- Finalmente nodos (encima de todo) -->
  {nodes.map(n => <NodeElement key={n.id} node={n} />)}
</svg>
```

### 10.4 Renderizado de flechas

elkjs devuelve `bendPoints` — los puntos de inflexión de cada flecha. El `EdgeElement` usa estos puntos para construir un path SVG suavizado:

```typescript
// Construir path SVG desde bendPoints de elkjs
function buildEdgePath(points: Point[]): string {
  if (points.length < 2) return ''

  const [start, ...rest] = points
  const pathParts = [`M ${start.x} ${start.y}`]

  rest.forEach((point) => {
    pathParts.push(`L ${point.x} ${point.y}`)
  })

  return pathParts.join(' ')
}
```

---

## 11. Motor de Layout — elkjs

### 11.1 ¿Qué es elkjs?

`elkjs` es la versión JavaScript del Eclipse Layout Kernel (ELK), un proyecto académico de la Universidad de Kiel mantenido por Eclipse Foundation. Fue creado completamente desde cero, independiente de Graphviz. La versión JS es una transpilación del código Java original usando GWT (Google Web Toolkit).

**Estado actual (Mayo 2026):**

- ELK Java: versión 0.11.0 (Septiembre 2025), activamente mantenido, 114 commits en últimos 12 meses
- elkjs: sincronizado en minor version con ELK Java, mantenido por el mismo equipo (kieler/elkjs en GitHub)

### 11.2 Algoritmo elegido para MVP

**`elk.algorithm: layered`** — El algoritmo flagship de ELK. Basado en el método de Sugiyama, produce layouts jerárquicos con dirección definida (LEFT→RIGHT o TOP→DOWN). Es el más adecuado para diagramas de arquitectura con flujos definidos.

### 11.3 Opciones de layout configuradas

```typescript
const LAYOUT_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT', // LR por defecto
  'elk.layered.spacing.nodeNodeBetweenLayers': '30', // Espacio horizontal entre capas
  'elk.spacing.nodeNode': '10', // Espacio entre nodos
  'elk.padding': '[top=10,left=10,bottom=10,right=10]', // Padding dentro del root
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN', // Crítico para clusters anidados
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP', // Minimiza cruces
  'elk.edgeRouting': 'POLYLINE', // Diagonales naturales (ver §18.6)
  'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED'
}
```

Los clusters reciben un padding propio (`[top=24,left=8,bottom=8,right=8]`) que reserva espacio en la parte superior para el label del cluster sin invadir los nodos hijos.

### 11.4 Tamaños de nodos

elkjs necesita conocer el tamaño de cada nodo para calcular el layout. Los nodos de Diagen tienen tamaño fijo en el MVP:

```typescript
const NODE_SIZE = {
  width: 80,
  height: 80, // ícono + label debajo
  labelOffset: 16 // espacio extra para el label bajo el ícono
}
```

---

## 12. Sistema de Iconos Oficiales

### 12.1 Fuentes de iconos

Los iconos oficiales se obtienen de los asset packs publicados gratuitamente por cada proveedor:

| Proveedor  | Fuente oficial                                                          |
| ---------- | ----------------------------------------------------------------------- |
| AWS        | AWS Architecture Icons (aws.amazon.com/architecture/icons)              |
| GCP        | Google Cloud Icons (cloud.google.com/icons)                             |
| Azure      | Azure Architecture Icons (learn.microsoft.com/azure/architecture/icons) |
| Kubernetes | Kubernetes Icons Set (github.com/kubernetes/community)                  |
| OSS        | Logos oficiales de cada proyecto                                        |

### 12.2 Procesamiento de iconos

Los SVGs oficiales se procesan antes de ser incluidos en la app:

1. Se normalizan a viewBox `0 0 64 64`
2. Se eliminan colores de fondo si los tienen
3. Se convierten a strings y se importan como módulos TypeScript
4. Se registran en el `IconRegistry`

### 12.3 Icon Registry

```typescript
// registry.ts
const iconRegistry: Record<string, string> = {
  'aws/alb': awsAlbSvg,
  'aws/ecs': awsEcsSvg,
  'oss/nginx': nginxSvg,
  'oss/postgres': postgresSvg
  // ...
}

export function getIcon(type: string): string {
  return iconRegistry[type] ?? iconRegistry['oss/server'] // fallback a servidor genérico
}
```

### 12.4 Renderizado del nodo con ícono

```typescript
// NodeElement.tsx
function NodeElement({ node }: { node: LayoutNode }) {
  const iconSvg = getIcon(node.type)
  const iconSize = 56  // dentro del nodo de 80x80

  return (
    <g transform={`translate(${node.x}, ${node.y})`}>
      {/* Ícono SVG embebido */}
      <image
        href={`data:image/svg+xml;base64,${btoa(iconSvg)}`}
        x={(NODE_SIZE.width - iconSize) / 2}
        y={4}
        width={iconSize}
        height={iconSize}
      />
      {/* Label debajo del ícono */}
      <text
        x={NODE_SIZE.width / 2}
        y={NODE_SIZE.height + 14}
        textAnchor="middle"
        fontSize={12}
        fill="#333"
      >
        {node.label}
      </text>
    </g>
  )
}
```

---

## 13. File Watcher y Hot Reload

### 13.1 Flujo de eventos

```
filesystem (Claude Code guarda archivo.arch)
    ↓
Chokidar detecta evento 'change'
    ↓
fileWatcher.ts lee el contenido del archivo
    ↓
ipcMain.emit('arch-file-changed', contenido)
    ↓
preload/index.ts expone evento via contextBridge
    ↓
React recibe el nuevo contenido del DSL
    ↓
Re-ejecuta pipeline completo: parse → layout → render
    ↓
SVG actualizado en pantalla (< 500ms total)
```

### 13.2 Implementación del watcher

```typescript
// fileWatcher.ts
import chokidar from 'chokidar'
import { ipcMain, BrowserWindow } from 'electron'
import fs from 'fs/promises'

export function watchArchFile(filePath: string, win: BrowserWindow) {
  const watcher = chokidar.watch(filePath, {
    persistent: true,
    ignoreInitial: false, // Emite el archivo al arrancar también
    awaitWriteFinish: {
      stabilityThreshold: 100, // Espera 100ms sin cambios antes de emitir
      pollInterval: 50
    }
  })

  watcher.on('change', async (path) => {
    const content = await fs.readFile(path, 'utf-8')
    win.webContents.send('arch-file-changed', { path, content })
  })

  return watcher
}
```

### 13.3 IPC Bridge (preload)

```typescript
// preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('Diagen', {
  onFileChanged: (callback: (data: { path: string; content: string }) => void) => {
    ipcRenderer.on('arch-file-changed', (_, data) => callback(data))
  },
  openFile: () => ipcRenderer.invoke('open-file-dialog'),
  saveArchd: (path: string, data: object) => ipcRenderer.invoke('save-archd', { path, data })
})
```

---

## 14. Arquitectura Electron

### 14.1 Main Process

```typescript
// main/index.ts
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { watchArchFile } from './fileWatcher'
import { registerIpcHandlers } from './ipcHandlers'

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // Mac: título integrado
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false // Seguridad: nunca true
    }
  })

  registerIpcHandlers(win)

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)
```

### 14.2 IPC Handlers

```typescript
// main/ipcHandlers.ts
export function registerIpcHandlers(win: BrowserWindow) {
  // Abrir file picker para seleccionar .arch
  ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog(win, {
      filters: [{ name: 'Diagen Files', extensions: ['arch'] }],
      properties: ['openFile']
    })
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      watchArchFile(filePath, win)
      const content = await fs.readFile(filePath, 'utf-8')
      return { filePath, content }
    }
    return null
  })

  // Guardar .archd
  ipcMain.handle('save-archd', async (_, { path, data }) => {
    const archdPath = path.replace('.arch', '.archd')
    await fs.writeFile(archdPath, JSON.stringify(data, null, 2), 'utf-8')
  })
}
```

---

## 15. Componentes React

### 15.1 Jerarquía de componentes

```
App
├── Toolbar
│   ├── OpenFileButton
│   ├── ZoomControls
│   └── DiagramName
│
├── DiagramCanvas
│   ├── SVGViewport (zoom + pan)
│   │   ├── ClusterElement[]
│   │   ├── EdgeElement[]
│   │   └── NodeElement[]
│   └── EmptyState (cuando no hay archivo abierto)
│
└── StatusBar
    ├── FilePath
    ├── HotReloadIndicator
    └── NodeCount
```

### 15.2 DiagramCanvas — componente principal

```typescript
// DiagramCanvas.tsx
function DiagramCanvas() {
  const [archContent, setArchContent] = useState<string | null>(null)
  const [layoutResult, setLayoutResult] = useState<LayoutResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Escucha cambios del file watcher
  useEffect(() => {
    window.Diagen.onFileChanged(async ({ content }) => {
      setIsLoading(true)
      try {
        const kind = detectKind(content)             // 'cloud'
        const def = getKindDef(kind)
        const graph = def.parse(content)             // DSL → CloudGraph
        const layout = await def.layout(graph)       // CloudGraph → LayoutResult
        setLayoutResult(layout)
      } catch (err) {
        console.error('Error en pipeline:', err)
      } finally {
        setIsLoading(false)
      }
    })
  }, [])

  if (!layoutResult) return <EmptyState />

  return (
    <SVGViewport>
      {layoutResult.clusters.map(c => (
        <ClusterElement key={c.id} cluster={c} />
      ))}
      {layoutResult.edges.map(e => (
        <EdgeElement key={e.id} edge={e} />
      ))}
      {layoutResult.nodes.map(n => (
        <NodeElement key={n.id} node={n} />
      ))}
    </SVGViewport>
  )
}
```

---

## 16. Caso de Prueba Benchmark

La imagen de referencia provista (Arquitectura de Microservicios) es el benchmark del MVP. El MVP se considera exitoso cuando reproduce correctamente:

| Criterio                    | Descripción                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------- |
| ✅ Clusters                 | 4 grupos: Servicios, Workers, Datos, Observabilidad con bordes y labels            |
| ✅ Iconos correctos         | Nginx, Prometheus, Grafana, Kafka, Postgres, Redis con sus iconos oficiales        |
| ✅ Flechas con labels       | "publish", "consume" correctamente posicionados sobre las flechas                  |
| ✅ Flechas punteadas        | Las flechas hacia Observabilidad en estilo dashed                                  |
| ✅ Sin cruces incorrectos   | Las flechas de orders/payments a postgres/redis no cruzan Workers innecesariamente |
| ✅ Flechas terminan en nodo | Cada flecha apunta exactamente al borde del ícono destino                          |
| ✅ Labels de nodos          | Todos los nombres visibles y sin superposición                                     |
| ✅ Hot reload               | Agregar un nuevo nodo o edge actualiza el diagrama en < 500ms                      |

---

## 17. Fuera de Alcance MVP

Los siguientes items quedan explícitamente fuera del MVP y se documentan para versiones futuras:

- **Edición visual** — Drag & drop de nodos, resize de clusters, mover flechas
- **Export** — PNG, PDF, SVG, DrawIO XML
- **Múltiples archivos** — Tabs, workspace, proyectos
- **Temas de color por proveedor** — paletas diferenciadas para AWS, GCP, Azure (el toggle dark/light sí está incluido en el MVP)
- **ELK Java** — Sidecar Java para diagramas de miles de nodos
- **Undo/Redo** — Historial de cambios
- **Colaboración** — Sync en la nube, multiplayer
- **Plantillas** — Templates preconstruidos de arquitecturas comunes
- **Búsqueda** — Buscar nodos por nombre o tipo
- **Claude Code MCP** — Integración directa vía MCP para que Claude vea el diagrama renderizado
- **Auto-layout on edit** — Recalcular layout al editar visualmente

---

## 18. Decisiones de Diseño y Justificaciones

### 18.1 Dos formatos de archivo (`.arch` y `.archd`)

**Decisión:** Separar el formato de autoría (DSL declarativo) del formato de documento (JSON con posiciones).

**Justificación:** Cuando se agregue edición visual, la app necesita guardar las posiciones que el usuario ajustó manualmente. Si se usara un solo archivo, al editarlo Claude Code perdería las posiciones manuales, y al editarlo la app perdería la sintaxis limpia del DSL. La separación es el patrón que usan todos los editores maduros.

### 18.2 elkjs sobre Graphviz

**Decisión:** Usar elkjs como motor de layout en lugar de Graphviz (via viz.js o similar).

**Justificación:** Graphviz produce layouts incorrectos para diagramas con clusters anidados e iconos de tamaño variable, que es exactamente el caso de uso de Diagen. ELK fue diseñado específicamente para diagramas de software con jerarquía. El benchmark de la imagen de referencia falló con Graphviz.

### 18.3 Electron sobre Tauri

**Decisión:** Electron como shell de escritorio para el MVP.

**Justificación:** Tauri usa el WebView nativo del OS, lo que introduce inconsistencias de rendering SVG entre plataformas. Para un editor visual donde el rendering correcto es crítico, Electron con Chromium bundleado garantiza comportamiento idéntico. Tauri se puede evaluar para versiones futuras.

### 18.4 SVG sobre Canvas 2D o WebGL

**Decisión:** SVG nativo para renderizar el diagrama en el MVP.

**Justificación:** SVG es suficiente para el MVP y tiene ventajas importantes: los elementos son parte del DOM (accesibles, inspeccionables), CSS aplica directamente, y es el formato nativo de los iconos. Canvas 2D o WebGL (como usa Figma) son necesarios para miles de nodos o animaciones complejas — fuera del alcance del MVP.

### 18.5 DSL Mermaid-style sobre YAML como formato de autoría

**Decisión:** Adoptar un DSL declarativo inspirado en `mermaid architecture-beta` (con extensiones para labels de edge, direccionalidad y chains) en lugar del YAML inicialmente planteado.

**Justificación:**

1. **Densidad de tokens**: el DSL queda en ~60% menos tokens que YAML equivalente (`aws-deployment.arch` pasó de 134 a 50 líneas). En un agente con contexto limitado o que genera muchos diagramas por sesión, esto importa.
2. **Robustez**: YAML es sensible a indentación. Un espacio de más rompe el archivo silenciosamente. El DSL usa palabras clave + delimitadores explícitos (`group`, `service`, `[...]`, `-->`, etc.), así que la IA no rompe el archivo por desliz.
3. **Familiaridad para la IA**: Mermaid `architecture-beta` está en el training data masivo. Claude lo genera nativamente. No requiere system prompt extra para enseñárselo.
4. **Comentario auto-explicativo**: cada `.arch` lleva un comentario inicial de ~80 tokens con la gramática mínima. La IA infiere todo el lenguaje del archivo mismo (ver §8.2.1).

YAML quedó descartado tras prototipar ambos: la IA generaba YAML correctamente pero el archivo era 2.5× más verbose y los errores de indentación reaparecían al editar parcialmente.

**Trade-off conocido:** se mantiene un parser propio (lexer + recursive descent, ~400 líneas) en lugar de reusar `js-yaml`. La gramática es estrecha y la sintaxis no va a divergir mucho de Mermaid, así que el mantenimiento es bajo.

### 18.6 POLYLINE sobre ORTHOGONAL como `edgeRouting`

**Decisión:** Usar `elk.edgeRouting: 'POLYLINE'` en lugar del `'ORTHOGONAL'` planteado originalmente.

**Justificación:** Con `ORTHOGONAL` (segmentos solo horizontales y verticales) y clusters anidados (VPC → Subnet → Service), ELK introduce un canal extra cada vez que una flecha entra a un cluster por sus paddings, generando zigzags en escalera incluso cuando la conexión podría ser una L pura. Probamos tres alternativas:

1. **Post-procesado de bend points** para colapsar zigzags cortos en L: rompía la coordinación global de ELK (puertos, canales paralelos), provocando flechas que ya no entraban en el puerto correcto y líneas superpuestas.
2. **`SPLINES`** (curvas Bezier): visualmente agradable pero demasiado orgánico, no transmite la rigidez esperada en un diagrama de arquitectura cloud.
3. **`POLYLINE`**: ELK decide diagonales rectas naturales entre puntos de control, sin canales ortogonales forzados. Combinado con `stroke-linejoin: round` en el path SVG, los joins se ven suaves sin curvas exageradas.

POLYLINE produce el balance correcto entre limpieza visual (sin zigzags) y aspecto técnico (sin curvas).

---

## 19. Evolución Futura

### v1.1 — Edición visual básica

- Drag & drop de nodos
- El `.archd` se actualiza con las nuevas posiciones
- El `.arch` no se modifica al editar visualmente

### v1.2 — Export

- Export a PNG (via Electron screenshot del SVG)
- Export a SVG
- Export a DrawIO XML (para compatibilidad con equipos que lo usan)

### v2.0 — Editor completo

- Agregar/eliminar nodos desde la UI
- Cambiar tipo de ícono via dropdown
- Resize de clusters
- Migrar canvas a Konva.js para mejor performance

### v2.1 — ELK Java como motor alternativo

- ELK Java como sidecar via child_process de Electron
- Seleccionable por el usuario para diagramas grandes
- Mejora de performance para +500 nodos

### v3.0 — Integración MCP

- Diagen expone un servidor MCP local
- Claude Code puede leer el estado actual del diagrama
- Claude Code puede hacer queries: "¿qué nodos están en el cluster VPC?"
- Loop completo: Claude genera → ve el resultado → itera

---

## 20. Arquitectura Multi-Tipo

Diagen está diseñado para soportar **múltiples tipos de diagrama** bajo un mismo runtime: arquitectura cloud (`arch-cloud`, implementado), procesos BPMN (`arch-bpmn`, futuro), diagramas de secuencia (`arch-sequence`, futuro), ER (`arch-erd`), C4, etc.

Cada tipo es un **módulo independiente** que se enchufa al pipeline central. La regla del diseño: **agregar un tipo nuevo no requiere modificar el código de los demás**.

### 20.1 Anatomía de un tipo de diagrama

Cada tipo provee cuatro piezas, todas tipadas vía la interfaz `DiagramKindDef<Model, Layout>`:

| Pieza         | Responsabilidad                                                                           | Vive en                     |
| ------------- | ----------------------------------------------------------------------------------------- | --------------------------- |
| **Parser**    | Texto fuente → modelo de dominio (`Model`)                                                | `core/parser/kinds/<kind>/` |
| **Layout**    | Modelo → resultado con coordenadas (`Layout`)                                             | `core/layout/kinds/<kind>/` |
| **Canvas**    | Componente React que renderiza el `Layout`                                                | `components/kinds/<kind>/`  |
| **Accesores** | `getName`, `getBounds`, `getStats`, `serialize` para que el shell de la app sea agnóstico | en el registry              |

### 20.2 Dispatcher

`core/diagram/dispatcher.ts` lee la primera línea no-comentario del archivo. Si encuentra `arch-<kind>` y `<kind>` está registrado, devuelve ese tipo. Si no, lanza un error explícito. **No hay heurísticas de detección**: el header es la fuente de verdad.

```typescript
// Pseudo-código del dispatcher
export function detectKind(source: string): DiagramKind {
  const header = firstNonCommentLine(source).match(/^arch-([a-z0-9-]+)/)
  if (!header) throw new Error('Archivo sin header arch-<tipo>')
  return validateKnownKind(header[1])
}
```

### 20.3 Registry

`core/diagram/registry.ts` registra las definiciones disponibles en build-time:

```typescript
const KIND_REGISTRY: Record<DiagramKind, DiagramKindDef> = {
  cloud: cloudKindDef
  // future: bpmn: bpmnKindDef, sequence: sequenceKindDef, ...
}
```

Para añadir un tipo nuevo: implementar `DiagramKindDef`, importarlo, registrarlo aquí. El `App.tsx` lo recoge automáticamente vía el dispatcher.

### 20.4 Roadmap de tipos plausibles

| Tipo                   | Header       | Estado           | Layout engine ideal                | Notas                                            |
| ---------------------- | ------------ | ---------------- | ---------------------------------- | ------------------------------------------------ |
| Cloud / Microservicios | `arch-cloud` | **Implementado** | ELK `layered`                      | El MVP. Iconos por proveedor                     |
| Flowchart              | `arch-flow`  | Futuro           | ELK `layered`                      | Sintaxis Mermaid-style ya cercana                |
| Sequence               | `arch-seq`   | Futuro           | Layout custom (lanes verticales)   | Sin ELK; algoritmo de "swimlane + timeline"      |
| ER                     | `arch-erd`   | Futuro           | ELK `force` o `stress`             | Entidades + relaciones tipadas                   |
| State machine          | `arch-state` | Futuro           | ELK `layered` con soporte de loops | Estados, transiciones, eventos                   |
| C4                     | `arch-c4`    | Futuro           | ELK `layered`                      | Niveles: contexto/contenedor/componente          |
| BPMN                   | `arch-bpmn`  | Futuro           | Custom (swimlanes + ELK por lane)  | El más complejo: pools, lanes, eventos, gateways |

### 20.5 Ventajas

1. **Aislamiento**: un bug en el parser BPMN no toca cloud.
2. **Velocidad de iteración**: añadir un tipo nuevo es escribir un módulo, no refactor del shell.
3. **Vocabulario optimizado por tipo**: BPMN no tiene `service`, tendrá `task`/`gateway`/`event`; ese vocabulario vive solo en el módulo BPMN.
4. **Iconos por tipo**: cada kind puede traer su propio set sin polucionar el namespace de los demás.

---

_Documento generado: Mayo 2026_
_Versión: 1.1 — DSL `arch-cloud` + arquitectura multi-tipo_
_Estado: Aprobado para desarrollo MVP_
