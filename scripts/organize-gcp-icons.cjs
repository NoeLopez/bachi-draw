#!/usr/bin/env node
// Organiza los iconos SVG del pack oficial de GCP en la estructura de Bachi Draw.
//
// Fuentes (scripts/gcp-icons-raw/):
//   Category Icons/<Categoría>/SVG/*.svg  → gcp/groups/<categoría>.svg
//   Unique Icons/<Servicio>/SVG/*.svg     → gcp/<categoría>/<servicio>.svg
//   google-cloud-legacy-icons/<s>/<s>.svg → gcp/legacy/<servicio>.svg
//
// Solo se copian SVGs. El resto (PNG, AI, etc.) se ignora.

const fs = require('fs')
const path = require('path')

const RAW = path.join(__dirname, 'gcp-icons-raw')
const DEST = path.join(__dirname, '..', 'src', 'renderer', 'src', 'icons', 'gcp')

// Categoría de cada Unique Icon (no está en la estructura de carpetas del pack).
const UNIQUE_CATEGORIES = {
  'Cloud Storage': 'storage',
  'Apigee': 'networking',
  'Looker': 'analytics',
  'Hyperdisk': 'storage',
  'Security Command Center': 'security-identity',
  'Cloud Run': 'compute',
  'Mandiant': 'security-identity',
  'BigQuery': 'analytics',
  'Cloud SQL': 'databases',
  'GKE': 'containers',
  'Anthos': 'hybrid-multicloud',
  'Cloud Spanner': 'databases',
  'Vertex AI': 'ai-machine-learning',
  'AlloyDB': 'databases',
  'Threat Intelligence': 'security-identity',
  'Distributed Cloud': 'hybrid-multicloud',
  'Security Operations': 'security-identity',
  'Compute Engine': 'compute',
  'AI Hypercomputer': 'ai-machine-learning',
}

function toKebab(str) {
  return str
    .toLowerCase()
    .replace(/[_&]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function copyIcon(src, dest) {
  ensureDir(path.dirname(dest))
  fs.copyFileSync(src, dest)
}

// Encuentra el único SVG dentro de un directorio (busca en subdirectorios también).
function findSvg(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      const found = findSvg(full)
      if (found) return found
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.svg')) {
      return full
    }
  }
  return null
}

let copied = 0
let skipped = 0

// ── 1. Category Icons → gcp/groups/<categoría>.svg ───────────────────────────
const catDir = path.join(RAW, 'Category Icons')
if (fs.existsSync(catDir)) {
  for (const entry of fs.readdirSync(catDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const svgDir = path.join(catDir, entry.name, 'SVG')
    if (!fs.existsSync(svgDir)) continue
    const svg = findSvg(svgDir)
    if (!svg) { skipped++; continue }
    const name = toKebab(entry.name)
    const dest = path.join(DEST, 'groups', `${name}.svg`)
    copyIcon(svg, dest)
    console.log(`groups/${name}.svg`)
    copied++
  }
}

// ── 2. Unique Icons → gcp/<categoría>/<servicio>.svg ─────────────────────────
const uniqueDir = path.join(RAW, 'Unique Icons')
if (fs.existsSync(uniqueDir)) {
  for (const entry of fs.readdirSync(uniqueDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const svgDir = path.join(uniqueDir, entry.name, 'SVG')
    if (!fs.existsSync(svgDir)) continue
    const svg = findSvg(svgDir)
    if (!svg) { skipped++; continue }
    const category = UNIQUE_CATEGORIES[entry.name]
    if (!category) {
      console.warn(`  [sin categoría] Unique Icon omitido: ${entry.name}`)
      skipped++
      continue
    }
    const name = toKebab(entry.name)
    const dest = path.join(DEST, category, `${name}.svg`)
    copyIcon(svg, dest)
    console.log(`${category}/${name}.svg`)
    copied++
  }
}

// ── 3. Legacy → gcp/legacy/<servicio>.svg ────────────────────────────────────
const legacyDir = path.join(RAW, 'google-cloud-legacy-icons')
if (fs.existsSync(legacyDir)) {
  for (const entry of fs.readdirSync(legacyDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const svg = findSvg(path.join(legacyDir, entry.name))
    if (!svg) { skipped++; continue }
    // Los nombres legacy ya vienen en snake_case → convertir a kebab-case.
    const name = toKebab(entry.name)
    const dest = path.join(DEST, 'legacy', `${name}.svg`)
    copyIcon(svg, dest)
    console.log(`legacy/${name}.svg`)
    copied++
  }
}

console.log(`\n✓ ${copied} iconos copiados, ${skipped} omitidos.`)
console.log(`  Destino: ${DEST}`)
