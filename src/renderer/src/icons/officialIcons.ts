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

// Aliases del proveedor: el .arch puede usar el nombre corto (k8s) o el largo
// (kubernetes); ambos resuelven a la misma carpeta.
const PROVIDER_ALIASES: Record<string, string> = {
  k8s: 'kubernetes'
}

// Aliases de servicio dentro de un proveedor. La heurística de extracción del
// pack oficial de AWS produce los nombres largos (`elastic-load-balancing`),
// pero los `.arch` típicamente usan los acrónimos conocidos (`alb`). Este mapa
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

// import.meta.glob es resuelto por Vite en build-time. Incluimos los SVGs
// del nivel raíz de cada proveedor más las subcarpetas conocidas.
const SVG_MODULES = import.meta.glob(
  [
    './aws/*.svg',
    './aws/groups/*.svg',
    './gcp/*.svg',
    './azure/*.svg',
    './kubernetes/*.svg',
    './oss/*.svg'
  ],
  {
    query: '?url',
    import: 'default',
    eager: true
  }
) as Record<string, string>

const officialByType = new Map<string, string>()

for (const [path, url] of Object.entries(SVG_MODULES)) {
  // Posibles formas:
  //   ./aws/ec2.svg                       -> provider=aws, key=ec2
  //   ./aws/groups/vpc.svg                -> provider=aws, key=groups/vpc
  //   ./kubernetes/pod.svg                -> provider=k8s, key=pod
  const match = path.match(/^\.\/([^/]+)\/(.+)\.svg$/)
  if (!match) continue
  const [, folder, rest] = match
  const provider = folder === 'kubernetes' ? 'k8s' : folder
  officialByType.set(`${provider}/${rest}`, url)
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

export function listOfficialIconTypes(): string[] {
  return Array.from(officialByType.keys()).sort()
}
