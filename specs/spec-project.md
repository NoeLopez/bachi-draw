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

---

## 1. Visión General

**Diagen** es una herramienta de escritorio local diseñada desde cero para trabajar con agentes de IA como Claude Code. Permite generar y visualizar diagramas de arquitectura de software y cloud a partir de archivos de texto simples, con hot reload en tiempo real, iconos oficiales de proveedores (AWS, GCP, Azure, OSS), y un layout engine inteligente que elimina los problemas de flechas cruzadas, nodos superpuestos y texto mal posicionado que afectan a herramientas como DrawIO cuando son usadas por IA.

**Propuesta de valor única:** La única herramienta donde un agente de IA escribe un archivo de texto y el diagrama aparece instantáneamente con iconos oficiales y layout perfecto, sin coordenadas manuales ni XML frágil.

---

## 2. Contexto y Problema

### 2.1 Problema con herramientas existentes

Las herramientas actuales de diagramas no fueron diseñadas para ser generadas por IA:

| Herramienta | Problema con IA |
|---|---|
| DrawIO | XML posicional frágil, coordenadas absolutas, flechas sin garantía de conexión correcta |
| Lucidchart | SaaS propietario, sin API pública para generación programática |
| diagrams (Python) | Graphviz como motor (años 90), flechas que no conectan correctamente con clusters anidados |
| D2 / Mermaid | Sin iconos oficiales de proveedores cloud |
| Terrastruct | SaaS de pago, sin integración con agentes locales |

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

1. **Formato legible para IA** — Claude Code puede generar y editar el archivo `.arch` (YAML) sin conocer coordenadas ni IDs internos
2. **Layout automático correcto** — Flechas que conectan exactamente donde deben, sin cruces innecesarios, clusters bien delimitados
3. **Iconos oficiales** — AWS, GCP, Azure y tecnologías OSS comunes (Nginx, Postgres, Redis, Prometheus, Grafana, Kafka, etc.)
4. **Hot reload en tiempo real** — El diagrama se actualiza en menos de 500ms desde que Claude Code guarda el archivo
5. **Aplicación de escritorio** — Experiencia de app real, no un localhost en el browser
6. **Sin dependencias externas en runtime** — No requiere Java, Python, ni Docker para correr

---

## 4. Alcance del MVP

### Incluido

- Abrir y monitorear un archivo `.arch` (YAML)
- Parsear el YAML y transformarlo al formato elkjs
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
- Temas visuales (dark/light)
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
  │ (YAML)      │                    │  agente IA      │
  └─────────────┘                    └─────────────────┘
```

### Flujo de datos completo

```
1. Claude Code escribe/edita archivo.arch (YAML)
2. Chokidar detecta cambio en filesystem (< 50ms)
3. Main Process lee el archivo y lo envía via ipcMain
4. Renderer Process recibe el contenido YAML
5. YAMLParser transforma a estructura interna ArchGraph
6. ELKTransformer convierte ArchGraph al formato JSON de elkjs
7. elkjs.layout() calcula posiciones x,y de nodos y rutas de flechas
8. SVGRenderer genera el SVG con posiciones calculadas + iconos SVG
9. DiagramCanvas actualiza el DOM — el usuario ve el cambio
10. StateManager guarda el resultado en .archd (JSON)
```

---

## 6. Stack Tecnológico

| Capa | Tecnología | Versión | Justificación |
|---|---|---|---|
| Shell Desktop | **Electron** | ^35.x | Cross-platform, consistencia de rendering, mismo stack que DrawIO desktop, Claude Code puede construirlo completamente |
| Build Tool | **Vite** | ^6.x | Hot reload de desarrollo rápido, integración nativa con Electron via `electron-vite` |
| UI Framework | **React** | ^19.x | Ecosistema maduro, Claude Code lo genera con precisión |
| Lenguaje | **TypeScript** | ^5.x | Type safety, mejor DX, previene errores en transformaciones de datos |
| Layout Engine | **elkjs** | ^0.11.x | Motor moderno (Universidad de Kiel), algoritmos superiores a Graphviz, soporte nativo de clusters, sincronizado con ELK Java |
| File Watcher | **Chokidar** | ^4.x | Estándar de Node.js, usado internamente por Vite, confiable en todos los OS |
| YAML Parser | **js-yaml** | ^4.x | Parser YAML más usado en Node.js, manejo correcto de tipos |
| Renderizado | **SVG nativo** | — | Suficiente para MVP, editable via DOM, escalable sin pérdida de calidad |
| Iconos | **SVG Assets** | — | Packs oficiales de AWS, GCP, Azure, K8s + OSS empaquetados en la app |

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
│       │   ├── DiagramCanvas.tsx    # Canvas principal, contiene el SVG
│       │   ├── NodeElement.tsx      # Renderiza un nodo individual (ícono + label)
│       │   ├── EdgeElement.tsx      # Renderiza una flecha con su label
│       │   ├── ClusterElement.tsx   # Renderiza un grupo/cluster con su borde
│       │   ├── Toolbar.tsx          # Controles de zoom, abrir archivo
│       │   └── StatusBar.tsx        # Nombre del archivo, estado de hot reload
│       │
│       ├── core/
│       │   ├── parser/
│       │   │   ├── archParser.ts    # YAML → ArchGraph (estructura interna)
│       │   │   └── types.ts         # Tipos TypeScript: ArchGraph, ArchNode, ArchEdge, ArchCluster
│       │   │
│       │   ├── layout/
│       │   │   ├── elkTransformer.ts  # ArchGraph → formato JSON elkjs
│       │   │   ├── elkRunner.ts       # Ejecuta elk.layout(), retorna posiciones
│       │   │   └── layoutTypes.ts     # Tipos del resultado de layout
│       │   │
│       │   ├── renderer/
│       │   │   ├── svgRenderer.ts   # LayoutResult → SVG elements
│       │   │   └── viewportManager.ts # Zoom, pan, coordenadas
│       │   │
│       │   └── state/
│       │       ├── stateManager.ts  # Gestiona ArchGraph + LayoutResult
│       │       └── archdSerializer.ts # LayoutResult → .archd JSON
│       │
│       └── icons/
│           ├── registry.ts          # Map de tipo → SVG string
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

El archivo `.arch` es YAML simple. Es el formato que Claude Code y cualquier agente de IA deben generar. Está diseñado para ser:
- Escrito por IA sin conocer coordenadas
- Legible y editable por humanos
- Mínimo en su sintaxis
- Separado del estado de la aplicación (posiciones, zoom, etc.)

### 8.1 Schema completo

```yaml
# Metadata del diagrama
name: "Nombre del diagrama"          # Requerido
direction: LR                        # LR (left-right) | TB (top-bottom). Default: LR

# Nodos individuales (sin cluster)
nodes:
  - id: nombre_unico                 # Requerido. Snake_case, sin espacios
    type: aws/alb                    # Requerido. Ver sección de iconos
    label: "Load Balancer"           # Opcional. Si omitido, usa el id

# Clusters / grupos
clusters:
  - id: vpc                          # Requerido
    label: "VPC"                     # Requerido. Texto del header del grupo
    nodes:                           # Nodos dentro del cluster
      - id: ecs
        type: aws/ecs
        label: "Fargate"
      - id: rds
        type: aws/rds
        label: "Aurora"
    clusters:                        # Sub-clusters (anidamiento)
      - id: subnet_private
        label: "Private Subnet"
        nodes:
          - id: lambda
            type: aws/lambda
            label: "Lambda"

# Conexiones
edges:
  - from: alb                        # Requerido. ID del nodo origen
    to: ecs                          # Requerido. ID del nodo destino
    label: "HTTPS"                   # Opcional. Label de la flecha
    style: solid                     # solid | dashed. Default: solid
    direction: forward               # forward | back | both. Default: forward
```

### 8.2 Ejemplo real — Arquitectura de Microservicios

Este es el caso de prueba benchmark derivado de la imagen de referencia:

```yaml
name: "Arquitectura de Microservicios"
direction: LR

nodes:
  - id: clientes
    type: oss/users
    label: "clientes"
  - id: api_gateway
    type: oss/nginx
    label: "api gateway"
  - id: eventos
    type: oss/kafka
    label: "eventos"

clusters:
  - id: servicios
    label: "Servicios"
    nodes:
      - id: auth
        type: oss/server
        label: "auth"
      - id: orders
        type: oss/server
        label: "orders"
      - id: payments
        type: oss/server
        label: "payments"

  - id: workers
    label: "Workers"
    nodes:
      - id: worker1
        type: oss/server
        label: "worker1"
      - id: worker2
        type: oss/server
        label: "worker2"

  - id: datos
    label: "Datos"
    nodes:
      - id: postgres
        type: oss/postgres
        label: "postgres"
      - id: redis
        type: oss/redis
        label: "redis"

  - id: observabilidad
    label: "Observabilidad"
    nodes:
      - id: prometheus
        type: oss/prometheus
        label: "prometheus"
      - id: grafana
        type: oss/grafana
        label: "grafana"

edges:
  - from: clientes
    to: api_gateway
  - from: api_gateway
    to: auth
  - from: api_gateway
    to: orders
  - from: api_gateway
    to: payments
  - from: auth
    to: eventos
    label: "publish"
    style: dashed
  - from: orders
    to: eventos
    label: "publish"
  - from: payments
    to: eventos
    label: "publish"
  - from: eventos
    to: worker1
    label: "consume"
  - from: eventos
    to: worker2
    label: "consume"
  - from: worker1
    to: postgres
  - from: worker2
    to: postgres
  - from: orders
    to: postgres
  - from: payments
    to: postgres
  - from: orders
    to: redis
  - from: payments
    to: redis
  - from: worker1
    to: observabilidad
    style: dashed
  - from: prometheus
    to: grafana
```

### 8.3 Tipos de iconos soportados en MVP

#### AWS
| type | Descripción |
|---|---|
| `aws/alb` | Application Load Balancer |
| `aws/ec2` | EC2 Instance |
| `aws/ecs` | ECS / Fargate |
| `aws/lambda` | Lambda Function |
| `aws/rds` | RDS |
| `aws/aurora` | Aurora |
| `aws/s3` | S3 Bucket |
| `aws/cloudfront` | CloudFront |
| `aws/route53` | Route 53 |
| `aws/vpc` | VPC |
| `aws/sqs` | SQS |
| `aws/sns` | SNS |
| `aws/elasticache` | ElastiCache |
| `aws/apigateway` | API Gateway |
| `aws/cognito` | Cognito |
| `aws/iam` | IAM |

#### GCP
| type | Descripción |
|---|---|
| `gcp/gke` | Google Kubernetes Engine |
| `gcp/cloudsql` | Cloud SQL |
| `gcp/gcs` | Cloud Storage |
| `gcp/cloudrun` | Cloud Run |
| `gcp/pubsub` | Pub/Sub |
| `gcp/bigquery` | BigQuery |
| `gcp/loadbalancer` | Load Balancing |

#### Azure
| type | Descripción |
|---|---|
| `azure/aks` | Azure Kubernetes Service |
| `azure/appservice` | App Service |
| `azure/sql` | Azure SQL |
| `azure/blob` | Blob Storage |
| `azure/servicebus` | Service Bus |
| `azure/functions` | Azure Functions |

#### Kubernetes
| type | Descripción |
|---|---|
| `k8s/pod` | Pod |
| `k8s/deployment` | Deployment |
| `k8s/service` | Service |
| `k8s/ingress` | Ingress |
| `k8s/configmap` | ConfigMap |
| `k8s/namespace` | Namespace |

#### OSS (Open Source)
| type | Descripción |
|---|---|
| `oss/nginx` | Nginx |
| `oss/postgres` | PostgreSQL |
| `oss/redis` | Redis |
| `oss/kafka` | Apache Kafka |
| `oss/rabbitmq` | RabbitMQ |
| `oss/mongodb` | MongoDB |
| `oss/prometheus` | Prometheus |
| `oss/grafana` | Grafana |
| `oss/elasticsearch` | Elasticsearch |
| `oss/server` | Servidor genérico |
| `oss/users` | Usuarios / Clientes |
| `oss/browser` | Browser |
| `oss/mobile` | Mobile App |

---

## 9. Formato de Archivo `.archd`

El archivo `.archd` es el formato de documento guardado. Lo escribe y lee la aplicación. Contiene toda la información necesaria para restaurar el estado visual exacto del diagrama, incluyendo posiciones calculadas por elkjs o ajustadas manualmente en el futuro.

**Regla importante:** El archivo `.arch` (YAML) es la fuente de verdad de la topología. El `.archd` es el estado visual. Si existe un `.archd` para el `.arch` abierto, la app usa las posiciones del `.archd`. Si no existe, calcula el layout desde cero con elkjs.

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

### 10.1 Transformación YAML → ArchGraph

```typescript
// types.ts
interface ArchNode {
  id: string
  type: string
  label: string
  clusterId?: string        // ID del cluster padre, si aplica
}

interface ArchEdge {
  id: string
  from: string
  to: string
  label?: string
  style: 'solid' | 'dashed'
  direction: 'forward' | 'back' | 'both'
}

interface ArchCluster {
  id: string
  label: string
  nodeIds: string[]
  childClusterIds: string[]
  parentClusterId?: string
}

interface ArchGraph {
  name: string
  direction: 'LR' | 'TB'
  nodes: ArchNode[]
  edges: ArchEdge[]
  clusters: ArchCluster[]
}
```

### 10.2 Transformación ArchGraph → formato elkjs

elkjs espera un grafo JSON con `children` (nodos) y `edges`. Los clusters se representan como nodos con sus propios `children`.

```typescript
// elkTransformer.ts — lógica de transformación

function toElkGraph(graph: ArchGraph): ElkNode {
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': graph.direction === 'LR' ? 'RIGHT' : 'DOWN',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.nodeNode': '40',
      'elk.padding': '[top=40,left=40,bottom=40,right=40]',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
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

  rest.forEach(point => {
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
  'elk.direction': 'RIGHT',                              // LR por defecto
  'elk.layered.spacing.nodeNodeBetweenLayers': '80',    // Espacio horizontal entre capas
  'elk.spacing.nodeNode': '40',                          // Espacio entre nodos
  'elk.padding': '[top=40,left=40,bottom=40,right=40]', // Padding dentro de clusters
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',           // Crítico para clusters anidados
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP', // Minimiza cruces
  'elk.edgeRouting': 'ORTHOGONAL',                       // Flechas ortogonales (90°)
}
```

### 11.4 Tamaños de nodos

elkjs necesita conocer el tamaño de cada nodo para calcular el layout. Los nodos de Diagen tienen tamaño fijo en el MVP:

```typescript
const NODE_SIZE = {
  width: 80,
  height: 80,   // ícono + label debajo
  labelOffset: 16  // espacio extra para el label bajo el ícono
}
```

---

## 12. Sistema de Iconos Oficiales

### 12.1 Fuentes de iconos

Los iconos oficiales se obtienen de los asset packs publicados gratuitamente por cada proveedor:

| Proveedor | Fuente oficial |
|---|---|
| AWS | AWS Architecture Icons (aws.amazon.com/architecture/icons) |
| GCP | Google Cloud Icons (cloud.google.com/icons) |
| Azure | Azure Architecture Icons (learn.microsoft.com/azure/architecture/icons) |
| Kubernetes | Kubernetes Icons Set (github.com/kubernetes/community) |
| OSS | Logos oficiales de cada proyecto |

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
  'aws/alb':        awsAlbSvg,
  'aws/ecs':        awsEcsSvg,
  'oss/nginx':      nginxSvg,
  'oss/postgres':   postgresSvg,
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
React recibe el nuevo contenido YAML
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
    ignoreInitial: false,   // Emite el archivo al arrancar también
    awaitWriteFinish: {
      stabilityThreshold: 100,  // Espera 100ms sin cambios antes de emitir
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
    titleBarStyle: 'hiddenInset',  // Mac: título integrado
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false        // Seguridad: nunca true
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
        const graph = parseArch(content)           // YAML → ArchGraph
        const elkGraph = toElkGraph(graph)         // ArchGraph → elkjs format
        const result = await elk.layout(elkGraph)  // elkjs calcula posiciones
        setLayoutResult(transformResult(result))   // elkjs result → LayoutResult
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

| Criterio | Descripción |
|---|---|
| ✅ Clusters | 4 grupos: Servicios, Workers, Datos, Observabilidad con bordes y labels |
| ✅ Iconos correctos | Nginx, Prometheus, Grafana, Kafka, Postgres, Redis con sus iconos oficiales |
| ✅ Flechas con labels | "publish", "consume" correctamente posicionados sobre las flechas |
| ✅ Flechas punteadas | Las flechas hacia Observabilidad en estilo dashed |
| ✅ Sin cruces incorrectos | Las flechas de orders/payments a postgres/redis no cruzan Workers innecesariamente |
| ✅ Flechas terminan en nodo | Cada flecha apunta exactamente al borde del ícono destino |
| ✅ Labels de nodos | Todos los nombres visibles y sin superposición |
| ✅ Hot reload | Agregar un nuevo nodo o edge actualiza el diagrama en < 500ms |

---

## 17. Fuera de Alcance MVP

Los siguientes items quedan explícitamente fuera del MVP y se documentan para versiones futuras:

- **Edición visual** — Drag & drop de nodos, resize de clusters, mover flechas
- **Export** — PNG, PDF, SVG, DrawIO XML
- **Múltiples archivos** — Tabs, workspace, proyectos
- **Temas** — Dark mode, light mode, temas de color por proveedor
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

**Decisión:** Separar el formato de autoría (YAML simple) del formato de documento (JSON con posiciones).

**Justificación:** Cuando se agregue edición visual, la app necesita guardar las posiciones que el usuario ajustó manualmente. Si se usara un solo archivo, al editarlo Claude Code perdería las posiciones manuales, y al editarlo la app perdería la sintaxis limpia del YAML. La separación es el patrón que usan todos los editores maduros.

### 18.2 elkjs sobre Graphviz

**Decisión:** Usar elkjs como motor de layout en lugar de Graphviz (via viz.js o similar).

**Justificación:** Graphviz produce layouts incorrectos para diagramas con clusters anidados e iconos de tamaño variable, que es exactamente el caso de uso de Diagen. ELK fue diseñado específicamente para diagramas de software con jerarquía. El benchmark de la imagen de referencia falló con Graphviz.

### 18.3 Electron sobre Tauri

**Decisión:** Electron como shell de escritorio para el MVP.

**Justificación:** Tauri usa el WebView nativo del OS, lo que introduce inconsistencias de rendering SVG entre plataformas. Para un editor visual donde el rendering correcto es crítico, Electron con Chromium bundleado garantiza comportamiento idéntico. Tauri se puede evaluar para versiones futuras.

### 18.4 SVG sobre Canvas 2D o WebGL

**Decisión:** SVG nativo para renderizar el diagrama en el MVP.

**Justificación:** SVG es suficiente para el MVP y tiene ventajas importantes: los elementos son parte del DOM (accesibles, inspeccionables), CSS aplica directamente, y es el formato nativo de los iconos. Canvas 2D o WebGL (como usa Figma) son necesarios para miles de nodos o animaciones complejas — fuera del alcance del MVP.

### 18.5 YAML como formato de autoría

**Decisión:** YAML para el archivo `.arch` que escribe Claude Code.

**Justificación:** YAML es más legible que JSON (sin llaves ni comillas en casos simples), es el formato estándar de Kubernetes y Docker Compose que los arquitectos ya conocen, y es trivial de parsear en Node.js. Claude Code lo genera limpio sin errores de sintaxis.

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

*Documento generado: Mayo 2026*
*Versión: 1.0*
*Estado: Aprobado para desarrollo MVP*
