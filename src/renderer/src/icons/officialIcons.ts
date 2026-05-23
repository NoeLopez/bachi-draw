// Auto-discovery de iconos SVG oficiales empaquetados con la app.
//
// Convención de nombres:
//   <provider>/<service>  ->  src/renderer/src/icons/<provider>/<service>.svg
//
// Subcarpetas:
//   <provider>/<grupo>/<service>  ->  src/renderer/src/icons/<provider>/<grupo>/<service>.svg
//   (ej. icons/aws/groups/vpc.svg para bordes de cluster tipo VPC)
//
// Aliases (acrónimos comunes de AWS):
//   aws/alb -> aws/elastic-load-balancing
//   aws/s3  -> aws/simple-storage-service
//   aws/iam -> aws/identity-and-access-management
//   ... ver SERVICE_ALIASES.
//
// Notas:
//   - Vite procesa los SVG como assets con hash y los sirve desde 'self'
//     (compatible con el CSP de index.html: img-src 'self' data:).
//   - No hace falta tocar nada al añadir un .svg: el glob los detecta en build.
//   - Si un archivo no existe ni alias, se usa el placeholder del IconRegistry.

// Aliases del proveedor: el .bachi puede usar el nombre corto (k8s) o el largo
// (kubernetes); ambos resuelven a la misma carpeta.
const PROVIDER_ALIASES: Record<string, string> = {
  k8s: 'kubernetes'
}

// Aliases de servicio dentro de un proveedor. La heurística de extracción del
// pack oficial de AWS produce los nombres largos (`elastic-load-balancing`),
// pero los `.bachi` típicamente usan los acrónimos conocidos (`alb`). Este mapa
// resuelve esos acrónimos al archivo real.
const SERVICE_ALIASES: Record<string, Record<string, string>> = {
  aws: {
    alb: 'elastic-load-balancing',
    elb: 'elastic-load-balancing',
    ecs: 'elastic-container-service',
    ecr: 'elastic-container-registry',
    eks: 'elastic-kubernetes-service',
    sqs: 'simple-queue-service',
    sns: 'simple-notification-service',
    s3: 'simple-storage-service',
    iam: 'identity-and-access-management',
    vpc: 'virtual-private-cloud',
    dms: 'database-migration-service',
    apigateway: 'api-gateway',
    route53: 'route-53',
    'api-gw': 'api-gateway',
    cloudwatch: 'cloudwatch', // ya existe sin acrónimo
    sfn: 'step-functions',
    mq: 'mq', // ya existe sin alias
    kms: 'key-management-service',
    glacier: 'simple-storage-service-glacier',
    's3-glacier': 'simple-storage-service-glacier',
    rabbit: 'mq',
    'amazon-mq': 'mq',
    opensearch: 'opensearch-service',
    'elastic-search': 'opensearch-service'
  }
}

// import.meta.glob es resuelto por Vite en build-time.
//
// Estructura en disco (definitiva): los iconos de servicio se organizan por
// CATEGORÍA en subcarpetas — ./aws/<categoria>/<servicio>.svg — pero el TIPO
// lógico es plano (aws/<servicio>): la categoría es solo metadato para agrupar
// en el panel, no parte de la identidad del icono. Así los .bachi y los aliases
// no dependen de la categoría. Mismo patrón aplicará a gcp/azure cuando lleguen.
//
// Excepción: ./aws/groups/<x>.svg son bordes de cluster y conservan el tipo
// aws/groups/<x> (no son servicios).
// Glob recursivo (**): captura tanto los planos (oss/nginx.svg) como los
// anidados por categoría (aws/compute/ec2.svg). El glob `**` resuelve de forma
// consistente en build; el desglose de provider/categoría/servicio se hace
// abajo a partir del path.
const SVG_MODULES = import.meta.glob(['./*/*.svg', './*/*/*.svg'], {
  query: '?url',
  import: 'default',
  eager: true
}) as Record<string, string>

const officialByType = new Map<string, string>()
// Tipo de icono -> categoría (para agrupar en el panel). Solo servicios.
const categoryByType = new Map<string, string>()

for (const [path, url] of Object.entries(SVG_MODULES)) {
  // path: ./<folder>/<...rest>.svg
  const match = path.match(/^\.\/([^/]+)\/(.+)\.svg$/)
  if (!match) continue
  const [, folder, rest] = match
  const provider = folder === 'kubernetes' ? 'k8s' : folder

  const slash = rest.indexOf('/')
  if (slash === -1) {
    // Plano (oss/nginx.svg, k8s/pod.svg): el tipo es provider/nombre.
    officialByType.set(`${provider}/${rest}`, url)
    continue
  }
  const sub = rest.slice(0, slash) // categoría o "groups"
  const name = rest.slice(slash + 1)
  if (sub === 'groups') {
    // Bordes de cluster: conservan el path en el tipo (aws/groups/vpc).
    officialByType.set(`${provider}/groups/${name}`, url)
  } else if (sub === 'shapes') {
    // Figuras básicas: conservan el path completo (oss/shapes/rectangle) y
    // llevan categoría 'shapes' para agruparse en el panel.
    const type = `${provider}/shapes/${name}`
    officialByType.set(type, url)
    categoryByType.set(type, sub)
  } else {
    // Servicio organizado por categoría: tipo plano + categoría como metadato.
    const type = `${provider}/${name}`
    officialByType.set(type, url)
    categoryByType.set(type, sub)
  }
}

function resolveAlias(provider: string, name: string): string | undefined {
  return SERVICE_ALIASES[provider]?.[name]
}

export function getOfficialIconUrl(type: string): string | undefined {
  // 1. Match directo.
  const direct = officialByType.get(type)
  if (direct) return direct

  const slash = type.indexOf('/')
  if (slash === -1) return undefined
  const provider = type.slice(0, slash)
  const name = type.slice(slash + 1)

  // 2. Alias de servicio dentro del mismo proveedor (alb -> elastic-load-balancing).
  const aliased = resolveAlias(provider, name)
  if (aliased) {
    const viaAlias = officialByType.get(`${provider}/${aliased}`)
    if (viaAlias) return viaAlias
  }

  // 3. Alias del proveedor (k8s -> kubernetes).
  const altProvider = PROVIDER_ALIASES[provider]
  if (altProvider) {
    return officialByType.get(`${altProvider}/${name}`)
  }

  return undefined
}

/** MIME type del dataTransfer al arrastrar un icono del panel al lienzo. */
export const ICON_DND_TYPE = 'application/bachi-draw-icon'

export function listOfficialIconTypes(): string[] {
  return Array.from(officialByType.keys()).sort()
}

/** Categoría de un tipo de icono (ej. aws/ec2 → compute), o undefined si no la
 * tiene (servicios sin categoría, bordes de grupo, placeholders). */
export function getIconCategory(type: string): string | undefined {
  return categoryByType.get(type)
}

/**
 * Etiqueta legible a partir de un tipo de icono.
 *   aws/ec2                     -> EC2
 *   aws/simple-storage-service  -> Simple Storage Service
 * Acrónimos cortos (≤4 chars, sin guiones) van en mayúsculas; el resto en
 * Title Case con espacios.
 */
export function humanizeIconType(type: string): string {
  const name = type.split('/').pop() ?? type
  if (!name.includes('-') && name.length <= 4) return name.toUpperCase()
  return name
    .split('-')
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}
