import { promises as fs } from 'fs'
import path from 'path'

export function archdPathFor(archPath: string): string {
  const dir = path.dirname(archPath)
  const base = path.basename(archPath, path.extname(archPath))
  return path.join(dir, `${base}.bachid`)
}

export async function readText(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8')
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    const text = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(text) as T
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}
