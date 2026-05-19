// Auto-discovery de iconos SVG oficiales empaquetados con la app.
//
// Convención (case-sensitive):
//   <provider>/<service>  ->  src/renderer/src/icons/<provider>/<service>.svg
//
// Ejemplos:
//   aws/alb         ->  icons/aws/alb.svg
//   aws/ec2         ->  icons/aws/ec2.svg
//   oss/postgres    ->  icons/oss/postgres.svg
//   k8s/pod         ->  icons/kubernetes/pod.svg   (alias: k8s -> kubernetes)
//
// Notas:
//   - Vite procesa los SVG como assets con hash y los sirve desde 'self'
//     (compatible con el CSP de index.html: img-src 'self' data:).
//   - No hace falta tocar nada al añadir un .svg: el glob los detecta en build.
//   - Si un archivo no existe, se usa el placeholder inline del IconRegistry.

const PROVIDER_ALIASES: Record<string, string> = {
  k8s: 'kubernetes'
}

// import.meta.glob es resuelto por Vite en build-time. La forma con `query: '?url'`
// hace que cada entrada sea la URL del asset (procesado y hasheado).
const SVG_MODULES = import.meta.glob('./{aws,gcp,azure,kubernetes,oss}/*.svg', {
  query: '?url',
  import: 'default',
  eager: true
}) as Record<string, string>

const officialByType = new Map<string, string>()

for (const [path, url] of Object.entries(SVG_MODULES)) {
  // path luce como './aws/alb.svg'
  const match = path.match(/^\.\/([^/]+)\/([^/]+)\.svg$/)
  if (!match) continue
  const [, folder, name] = match
  // El tipo del .arch usa el alias corto (ej. k8s en vez de kubernetes).
  const provider = folder === 'kubernetes' ? 'k8s' : folder
  officialByType.set(`${provider}/${name}`, url)
}

export function getOfficialIconUrl(type: string): string | undefined {
  const direct = officialByType.get(type)
  if (direct) return direct
  // Intentar resolver alias del proveedor (kubernetes -> k8s y viceversa).
  const slash = type.indexOf('/')
  if (slash === -1) return undefined
  const provider = type.slice(0, slash)
  const aliased = PROVIDER_ALIASES[provider]
  if (!aliased) return undefined
  return officialByType.get(`${aliased}/${type.slice(slash + 1)}`)
}

export function listOfficialIconTypes(): string[] {
  return Array.from(officialByType.keys()).sort()
}
