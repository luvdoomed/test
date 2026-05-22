import {
  BaseDirectory,
  mkdir,
  exists,
  writeTextFile,
  readTextFile,
  remove,
  rename,
} from '@tauri-apps/plugin-fs'
import { isTauri } from '../utils/platform'
import type { UserVisualizerMeta } from './types'

const ROOT = 'Loomi'
const VIZ_DIR = `${ROOT}/visualizers`
const MANIFEST_PATH = `${ROOT}/user-visualizers.json`
const MANIFEST_TMP = `${ROOT}/user-visualizers.json.tmp`
const APPDATA: BaseDirectory = BaseDirectory.AppData

export function isUserVizPersistenceAvailable(): boolean {
  return isTauri()
}

export async function ensureUserVizDirs(): Promise<void> {
  if (!isUserVizPersistenceAvailable()) return
  try {
    if (!(await exists(ROOT, { baseDir: APPDATA }))) {
      await mkdir(ROOT, { baseDir: APPDATA, recursive: true })
    }
    if (!(await exists(VIZ_DIR, { baseDir: APPDATA }))) {
      await mkdir(VIZ_DIR, { baseDir: APPDATA, recursive: true })
    }
  } catch (err) {
    console.warn('[userViz] не удалось создать каталог визуализаторов:', err)
    throw err
  }
}

export async function saveUserVizFile(vizId: string, tsxSource: string): Promise<string> {
  if (!isUserVizPersistenceAvailable()) {
    throw new Error('Persistence unavailable')
  }
  await ensureUserVizDirs()
  const rel = `visualizers/${vizId}.tsx`
  const full = `${ROOT}/${rel}`
  await writeTextFile(full, tsxSource, { baseDir: APPDATA })
  return rel
}

export async function readUserVizFile(sourcePath: string): Promise<string> {
  if (!isUserVizPersistenceAvailable()) {
    throw new Error('Persistence unavailable')
  }
  const full = `${ROOT}/${sourcePath}`
  return await readTextFile(full, { baseDir: APPDATA })
}

export async function deleteUserVizFile(sourcePath: string): Promise<void> {
  if (!isUserVizPersistenceAvailable()) return
  const full = `${ROOT}/${sourcePath}`
  try {
    if (await exists(full, { baseDir: APPDATA })) {
      await remove(full, { baseDir: APPDATA })
    }
  } catch (err) {
    console.warn('[userViz] не удалось удалить файл', sourcePath, err)
  }
}

function isValidMeta(v: unknown): v is UserVisualizerMeta {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    Array.isArray(o.moods) &&
    o.moods.every((m) => typeof m === 'string') &&
    typeof o.sourcePath === 'string' &&
    typeof o.createdAt === 'string'
  )
}

export async function loadUserVizManifest(): Promise<UserVisualizerMeta[]> {
  if (!isUserVizPersistenceAvailable()) return []
  try {
    if (!(await exists(MANIFEST_PATH, { baseDir: APPDATA }))) return []
    const text = await readTextFile(MANIFEST_PATH, { baseDir: APPDATA })
    if (!text.trim()) return []
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) {
      console.warn('[userViz] user-visualizers.json не массив')
      return []
    }
    const valid: UserVisualizerMeta[] = []
    for (const entry of parsed) {
      if (!isValidMeta(entry)) {
        console.warn('[userViz] пропущена битая запись:', entry)
        continue
      }
      valid.push(entry)
    }
    return valid
  } catch (err) {
    console.warn('[userViz] чтение манифеста упало:', err)
    return []
  }
}

let writeChain: Promise<void> = Promise.resolve()

export async function saveUserVizManifest(metas: UserVisualizerMeta[]): Promise<void> {
  if (!isUserVizPersistenceAvailable()) return
  const job = async (): Promise<void> => {
    try {
      await ensureUserVizDirs()
      const json = JSON.stringify(metas, null, 2)
      await writeTextFile(MANIFEST_TMP, json, { baseDir: APPDATA })
      if (await exists(MANIFEST_PATH, { baseDir: APPDATA })) {
        await remove(MANIFEST_PATH, { baseDir: APPDATA })
      }
      await rename(MANIFEST_TMP, MANIFEST_PATH, {
        oldPathBaseDir: APPDATA,
        newPathBaseDir: APPDATA,
      })
    } catch (err) {
      console.warn('[userViz] запись манифеста упала:', err)
      throw err
    }
  }
  writeChain = writeChain.then(job, job)
  return writeChain
}
