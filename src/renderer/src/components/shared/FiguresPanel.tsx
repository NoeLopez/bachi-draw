import { useMemo, useState } from 'react'
import {
  getIconCategory,
  humanizeIconType,
  ICON_DND_TYPE,
  listOfficialIconTypes
} from '../../icons/officialIcons'
import { getIconDataUri, listIconTypes } from '../../icons/registry'

// ──────────────────────────────────────────────────────────────────────────
// Panel lateral izquierdo de figuras: pestañas por proveedor (AWS / GCP / OSS)
// + buscador + iconos agrupados por categoría dentro de cada proveedor.
// Los iconos legacy de GCP aparecen en una sección "Legacy" al final.
// Cada icono se arrastra al lienzo (el tipo viaja en el dataTransfer).
// ──────────────────────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  aws: 'AWS',
  gcp: 'GCP',
  azure: 'Azure',
  k8s: 'K8s',
  oss: 'General',
}

function providerLabel(p: string): string {
  return PROVIDER_LABELS[p] ?? p.toUpperCase()
}

// Etiqueta legible de una categoría kebab (ej. "app-integration" → "App Integration").
function categoryLabel(cat: string): string {
  return cat
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function getProvider(type: string): string {
  return type.split('/')[0]
}

// Unión de iconos con SVG oficial + iconos de registry (placeholders).
// Los SVGs oficiales toman precedencia; los de registry cubren lo que falta (oss/*).
function listAllIconTypes(): string[] {
  const official = new Set(listOfficialIconTypes())
  const registry = listIconTypes().filter((t) => !official.has(t))
  return [...official, ...registry].sort()
}

// Proveedores visibles, en orden fijo. Solo aparecen los que tienen iconos
// Y están en esta lista — así se ocultan azure/k8s aunque tengan placeholders.
const PROVIDER_ORDER = ['aws', 'gcp', 'oss']

function listProviders(): string[] {
  const available = new Set(
    listAllIconTypes()
      .filter((t) => !t.includes('/groups/'))
      .map(getProvider)
  )
  return PROVIDER_ORDER.filter((p) => available.has(p))
}

interface Group {
  key: string
  label: string
  types: string[]
}

function buildGroups(query: string, provider: string): Group[] {
  const q = query.trim().toLowerCase()
  const all = listAllIconTypes().filter(
    (t) => !t.includes('/groups/') && getProvider(t) === provider
  )
  const byCategory = new Map<string, string[]>()
  for (const type of all) {
    if (q && !type.toLowerCase().includes(q) && !humanizeIconType(type).toLowerCase().includes(q)) {
      continue
    }
    // Los iconos legacy tienen su propia sección al final.
    const cat = type.includes('/legacy/') ? 'legacy' : (getIconCategory(type) ?? 'otros')
    const arr = byCategory.get(cat) ?? []
    arr.push(type)
    byCategory.set(cat, arr)
  }
  return Array.from(byCategory.entries())
    .map(([key, types]) => ({ key, label: categoryLabel(key), types }))
    .sort((a, b) => {
      if (a.key === 'legacy') return 1
      if (b.key === 'legacy') return -1
      return a.label.localeCompare(b.label)
    })
}

export default function FiguresPanel(): React.JSX.Element {
  const providers = useMemo(() => listProviders(), [])
  const [provider, setProvider] = useState(() => providers[0] ?? 'aws')
  const [query, setQuery] = useState('')
  const groups = useMemo(() => buildGroups(query, provider), [query, provider])
  const total = useMemo(() => groups.reduce((n, g) => n + g.types.length, 0), [groups])

  return (
    <aside className="bachi-draw-figures">
      <header className="bachi-draw-figures-head">
        <h2 className="bachi-draw-figures-title">Figuras</h2>
        <div className="bachi-draw-figures-tabs" role="tablist">
          {providers.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={p === provider}
              className={`bachi-draw-figures-tab${p === provider ? ' is-active' : ''}`}
              onClick={() => { setProvider(p); setQuery('') }}
            >
              {providerLabel(p)}
            </button>
          ))}
        </div>
        <input
          className="bachi-draw-figures-search"
          type="search"
          placeholder={`Buscar en ${providerLabel(provider)}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </header>

      <div className="bachi-draw-figures-list">
        {total === 0 ? (
          <p className="bachi-draw-figures-empty">Sin resultados para "{query}".</p>
        ) : (
          groups.map((g) => (
            <section key={g.key} className="bachi-draw-figures-group">
              <h3 className="bachi-draw-figures-group-title">
                {g.label} <span className="bachi-draw-figures-count">{g.types.length}</span>
              </h3>
              <div className="bachi-draw-figures-grid">
                {g.types.map((type) => (
                  <FigureItem key={type} type={type} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </aside>
  )
}

function FigureItem({ type }: { type: string }): React.JSX.Element {
  const label = humanizeIconType(type)
  return (
    <button
      type="button"
      className="bachi-draw-figure"
      title={label}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(ICON_DND_TYPE, type)
        e.dataTransfer.effectAllowed = 'copy'
      }}
    >
      <img className="bachi-draw-figure-img" src={getIconDataUri(type)} alt="" draggable={false} />
      <span className="bachi-draw-figure-label">{label}</span>
    </button>
  )
}
