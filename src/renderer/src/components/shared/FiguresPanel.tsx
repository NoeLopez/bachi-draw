import { useMemo, useState } from 'react'
import {
  getIconCategory,
  humanizeIconType,
  ICON_DND_TYPE,
  listOfficialIconTypes
} from '../../icons/officialIcons'
import { getIconDataUri } from '../../icons/registry'

// ──────────────────────────────────────────────────────────────────────────
// Panel lateral izquierdo de figuras: buscador + iconos agrupados por CATEGORÍA
// (Compute, Storage, Database...). Cada icono se arrastra al lienzo para crear
// un nodo (el tipo viaja en el dataTransfer; el drop lo maneja CloudCanvas).
// ──────────────────────────────────────────────────────────────────────────

// Etiqueta legible de una categoría kebab (ej. "app-integration" → "App
// Integration").
function categoryLabel(cat: string): string {
  return cat
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

interface Group {
  key: string
  label: string
  types: string[]
}

function buildGroups(query: string): Group[] {
  const q = query.trim().toLowerCase()
  // Excluye los iconos de grupo (bordes de cluster), no son servicios.
  const all = listOfficialIconTypes().filter((t) => !t.includes('/groups/'))
  const byCategory = new Map<string, string[]>()
  for (const type of all) {
    if (q && !type.toLowerCase().includes(q) && !humanizeIconType(type).toLowerCase().includes(q)) {
      continue
    }
    const cat = getIconCategory(type) ?? 'otros'
    const arr = byCategory.get(cat) ?? []
    arr.push(type)
    byCategory.set(cat, arr)
  }
  // Categorías ordenadas alfabéticamente por su etiqueta.
  return Array.from(byCategory.entries())
    .map(([key, types]) => ({ key, label: categoryLabel(key), types }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export default function FiguresPanel(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const groups = useMemo(() => buildGroups(query), [query])
  const total = useMemo(() => groups.reduce((n, g) => n + g.types.length, 0), [groups])

  return (
    <aside className="diagen-figures">
      <header className="diagen-figures-head">
        <h2 className="diagen-figures-title">Figuras</h2>
        <input
          className="diagen-figures-search"
          type="search"
          placeholder="Buscar icono…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </header>

      <div className="diagen-figures-list">
        {total === 0 ? (
          <p className="diagen-figures-empty">Sin resultados para “{query}”.</p>
        ) : (
          groups.map((g) => (
            <section key={g.key} className="diagen-figures-group">
              <h3 className="diagen-figures-group-title">
                {g.label} <span className="diagen-figures-count">{g.types.length}</span>
              </h3>
              <div className="diagen-figures-grid">
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
      className="diagen-figure"
      title={label}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(ICON_DND_TYPE, type)
        e.dataTransfer.effectAllowed = 'copy'
      }}
    >
      <img className="diagen-figure-img" src={getIconDataUri(type)} alt="" draggable={false} />
      <span className="diagen-figure-label">{label}</span>
    </button>
  )
}
