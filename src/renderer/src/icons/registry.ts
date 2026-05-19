import { getOfficialIconUrl } from './officialIcons'

interface IconSpec {
  bg: string
  fg: string
  text: string
  /** Forma del fondo. 'rect' por defecto. */
  shape?: 'rect' | 'hex' | 'circle' | 'pill'
}

const FALLBACK: IconSpec = { bg: '#6B7280', fg: '#FFFFFF', text: 'srv' }

// Paleta inspirada en colores oficiales de cada proveedor.
// Estos son placeholders de MVP — el spec §12 indica que deben reemplazarse por
// los SVGs oficiales de AWS, GCP, Azure y K8s antes de release.
const AWS_BG = '#FF9900'
const AWS_FG = '#232F3E'
const GCP_BG = '#4285F4'
const GCP_FG = '#FFFFFF'
const AZURE_BG = '#0078D4'
const AZURE_FG = '#FFFFFF'
const K8S_BG = '#326CE5'
const K8S_FG = '#FFFFFF'

const REGISTRY: Record<string, IconSpec> = {
  // ────────────────────────────── AWS ──────────────────────────────
  'aws/alb': { bg: AWS_BG, fg: AWS_FG, text: 'ALB' },
  'aws/ec2': { bg: AWS_BG, fg: AWS_FG, text: 'EC2' },
  'aws/ecs': { bg: AWS_BG, fg: AWS_FG, text: 'ECS' },
  'aws/lambda': { bg: '#ED8B26', fg: AWS_FG, text: 'λ' },
  'aws/rds': { bg: '#3B48CC', fg: '#FFFFFF', text: 'RDS', shape: 'pill' },
  'aws/aurora': { bg: '#3B48CC', fg: '#FFFFFF', text: 'Aur', shape: 'pill' },
  'aws/s3': { bg: '#7AA116', fg: '#FFFFFF', text: 'S3' },
  'aws/cloudfront': { bg: '#8C4FFF', fg: '#FFFFFF', text: 'CF' },
  'aws/route53': { bg: '#8C4FFF', fg: '#FFFFFF', text: 'R53' },
  'aws/vpc': { bg: '#7AA116', fg: '#FFFFFF', text: 'VPC' },
  'aws/sqs': { bg: '#FF4F8B', fg: '#FFFFFF', text: 'SQS' },
  'aws/sns': { bg: '#FF4F8B', fg: '#FFFFFF', text: 'SNS' },
  'aws/elasticache': { bg: '#3B48CC', fg: '#FFFFFF', text: 'Cache', shape: 'pill' },
  'aws/apigateway': { bg: '#FF4F8B', fg: '#FFFFFF', text: 'API' },
  'aws/cognito': { bg: '#DD344C', fg: '#FFFFFF', text: 'Cog' },
  'aws/iam': { bg: '#DD344C', fg: '#FFFFFF', text: 'IAM' },

  // ────────────────────────────── GCP ──────────────────────────────
  'gcp/gke': { bg: GCP_BG, fg: GCP_FG, text: 'GKE' },
  'gcp/cloudsql': { bg: '#1A73E8', fg: GCP_FG, text: 'SQL', shape: 'pill' },
  'gcp/gcs': { bg: '#34A853', fg: GCP_FG, text: 'GCS' },
  'gcp/cloudrun': { bg: '#4285F4', fg: GCP_FG, text: 'Run' },
  'gcp/pubsub': { bg: '#EA4335', fg: GCP_FG, text: 'P/S' },
  'gcp/bigquery': { bg: '#669DF6', fg: GCP_FG, text: 'BQ' },
  'gcp/loadbalancer': { bg: '#4285F4', fg: GCP_FG, text: 'LB' },

  // ────────────────────────────── Azure ────────────────────────────
  'azure/aks': { bg: AZURE_BG, fg: AZURE_FG, text: 'AKS' },
  'azure/appservice': { bg: AZURE_BG, fg: AZURE_FG, text: 'App' },
  'azure/sql': { bg: '#0062AD', fg: AZURE_FG, text: 'SQL', shape: 'pill' },
  'azure/blob': { bg: '#005BA1', fg: AZURE_FG, text: 'Blob' },
  'azure/servicebus': { bg: '#00BCF2', fg: AZURE_FG, text: 'Bus' },
  'azure/functions': { bg: '#FFB900', fg: '#1F1F1F', text: 'ƒ' },

  // ────────────────────────── Kubernetes ──────────────────────────
  'k8s/pod': { bg: K8S_BG, fg: K8S_FG, text: 'Pod', shape: 'hex' },
  'k8s/deployment': { bg: K8S_BG, fg: K8S_FG, text: 'Dep', shape: 'hex' },
  'k8s/service': { bg: K8S_BG, fg: K8S_FG, text: 'Svc', shape: 'hex' },
  'k8s/ingress': { bg: K8S_BG, fg: K8S_FG, text: 'Ing', shape: 'hex' },
  'k8s/configmap': { bg: K8S_BG, fg: K8S_FG, text: 'Cfg', shape: 'hex' },
  'k8s/namespace': { bg: K8S_BG, fg: K8S_FG, text: 'Ns', shape: 'hex' },

  // ────────────────────────────── OSS ──────────────────────────────
  'oss/nginx': { bg: '#009639', fg: '#FFFFFF', text: 'NGX' },
  'oss/postgres': { bg: '#336791', fg: '#FFFFFF', text: 'Pg', shape: 'pill' },
  'oss/redis': { bg: '#DC382D', fg: '#FFFFFF', text: 'Rd', shape: 'pill' },
  'oss/kafka': { bg: '#231F20', fg: '#FFFFFF', text: 'K', shape: 'circle' },
  'oss/rabbitmq': { bg: '#FF6600', fg: '#FFFFFF', text: 'MQ' },
  'oss/mongodb': { bg: '#47A248', fg: '#FFFFFF', text: 'Mo', shape: 'pill' },
  'oss/prometheus': { bg: '#E6522C', fg: '#FFFFFF', text: 'Pr' },
  'oss/grafana': { bg: '#F46800', fg: '#FFFFFF', text: 'Gf' },
  'oss/elasticsearch': { bg: '#005571', fg: '#FFFFFF', text: 'ES' },
  'oss/server': { bg: '#374151', fg: '#FFFFFF', text: 'srv' },
  'oss/users': { bg: '#0EA5E9', fg: '#FFFFFF', text: 'usr', shape: 'circle' },
  'oss/browser': { bg: '#0EA5E9', fg: '#FFFFFF', text: 'web', shape: 'circle' },
  'oss/mobile': { bg: '#0EA5E9', fg: '#FFFFFF', text: 'mob', shape: 'pill' }
}

function shapePath(shape: IconSpec['shape']): string {
  switch (shape) {
    case 'circle':
      return `<circle cx="32" cy="32" r="28" />`
    case 'hex':
      return `<polygon points="32,4 56,18 56,46 32,60 8,46 8,18" />`
    case 'pill':
      return `<rect x="4" y="14" width="56" height="36" rx="18" ry="18" />`
    case 'rect':
    default:
      return `<rect x="4" y="4" width="56" height="56" rx="10" ry="10" />`
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildSvg(spec: IconSpec): string {
  const fontSize = spec.text.length <= 2 ? 26 : spec.text.length === 3 ? 18 : 14
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">`,
    `<g fill="${spec.bg}" stroke="rgba(0,0,0,0.18)" stroke-width="1">`,
    shapePath(spec.shape),
    `</g>`,
    `<text x="32" y="32" text-anchor="middle" dominant-baseline="central"`,
    ` font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-weight="700"`,
    ` font-size="${fontSize}" fill="${spec.fg}">${escapeXml(spec.text)}</text>`,
    `</svg>`
  ].join('')
}

const svgCache = new Map<string, string>()

export function getIconSvg(type: string): string {
  const cached = svgCache.get(type)
  if (cached) return cached
  const spec = REGISTRY[type] ?? FALLBACK
  const svg = buildSvg(spec)
  svgCache.set(type, svg)
  return svg
}

export function getIconDataUri(type: string): string {
  // Si existe un SVG oficial empaquetado, se prefiere sobre el placeholder.
  const officialUrl = getOfficialIconUrl(type)
  if (officialUrl) return officialUrl
  const svg = getIconSvg(type)
  // Codificación segura para data URI (evita problemas con caracteres unicode en btoa).
  const encoded = encodeURIComponent(svg).replace(/'/g, '%27')
  return `data:image/svg+xml;charset=utf-8,${encoded}`
}

export function hasIcon(type: string): boolean {
  return type in REGISTRY || Boolean(getOfficialIconUrl(type))
}

export function listIconTypes(): string[] {
  return Object.keys(REGISTRY)
}
