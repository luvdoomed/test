import {
  BaseDirectory,
  mkdir,
  exists,
  writeFile,
  writeTextFile,
  readFile,
  readTextFile,
  remove,
  rename,
} from '@tauri-apps/plugin-fs'
import type { TrackFeatures } from '../audio/meydaAnalyzer'
import type { MoodWeights } from '../audio/moodEngine'
import { isTauri } from '../utils/platform'

const ROOT = 'Loomi'
const TRACKS_DIR = `${ROOT}/tracks`
const COVERS_DIR = `${ROOT}/covers`
const MANIFEST_PATH = `${ROOT}/library.json`
const MANIFEST_TMP = `${ROOT}/library.json.tmp`
const APPDATA: BaseDirectory = BaseDirectory.AppData

export interface PersistedTrack {
  id: string
  title: string
  artist: string
  album: string
  
  originalFileName: string | null
  
  sourceFileSize?: number | null
  audioPath: string
  coverPath: string | null
  features: TrackFeatures | null
  moodWeights: MoodWeights | null
  addedAt: string
  durationSec: number
}

export function isPersistenceAvailable(): boolean {
  return isTauri()
}

export async function ensureLibraryDirs(): Promise<void> {
  if (!isPersistenceAvailable()) return
  try {
    if (!(await exists(ROOT, { baseDir: APPDATA }))) {
      await mkdir(ROOT, { baseDir: APPDATA, recursive: true })
    }
    if (!(await exists(TRACKS_DIR, { baseDir: APPDATA }))) {
      await mkdir(TRACKS_DIR, { baseDir: APPDATA, recursive: true })
    }
    if (!(await exists(COVERS_DIR, { baseDir: APPDATA }))) {
      await mkdir(COVERS_DIR, { baseDir: APPDATA, recursive: true })
    }
  } catch (err) {
    console.warn('[persistence] не удалось создать каталоги:', err)
    throw err
  }
}

function audioExtFor(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName
  const fromType = file.type.split('/')[1]?.toLowerCase()
  if (fromType === 'mpeg') return 'mp3'
  if (fromType === 'x-flac') return 'flac'
  if (fromType === 'wav' || fromType === 'x-wav') return 'wav'
  if (fromType) return fromType
  return 'mp3'
}

function coverExtFor(mime: string): string {
  const t = mime.toLowerCase()
  if (t.includes('png')) return 'png'
  if (t.includes('webp')) return 'webp'
  if (t.includes('gif')) return 'gif'
  if (t.includes('bmp')) return 'bmp'
  return 'jpg'
}

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  const buf = await blob.arrayBuffer()
  return new Uint8Array(buf)
}

export async function saveTrackFiles(
  audioFile: File,
  coverBlob: Blob | null,
  trackId: string,
): Promise<{ audioPath: string; coverPath: string | null }> {
  await ensureLibraryDirs()

  const audioExt = audioExtFor(audioFile)
  const audioRel = `tracks/${trackId}.${audioExt}`
  const audioFull = `${ROOT}/${audioRel}`

  const audioBytes = await blobToBytes(audioFile)
  await writeFile(audioFull, audioBytes, { baseDir: APPDATA })

  let coverRel: string | null = null
  if (coverBlob) {
    const coverExt = coverExtFor(coverBlob.type)
    coverRel = `covers/${trackId}.${coverExt}`
    const coverFull = `${ROOT}/${coverRel}`
    const coverBytes = await blobToBytes(coverBlob)
    await writeFile(coverFull, coverBytes, { baseDir: APPDATA })
  }

  return { audioPath: audioRel, coverPath: coverRel }
}

export async function saveCoverBlob(coverBlob: Blob, trackId: string): Promise<string> {
  await ensureLibraryDirs()
  const coverExt = coverExtFor(coverBlob.type)
  const coverRel = `covers/${trackId}.${coverExt}`
  const coverFull = `${ROOT}/${coverRel}`
  const coverBytes = await blobToBytes(coverBlob)
  await writeFile(coverFull, coverBytes, { baseDir: APPDATA })
  return coverRel
}

function isValidPersistedTrack(v: unknown): v is PersistedTrack {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.title === 'string' &&
    typeof o.artist === 'string' &&
    typeof o.audioPath === 'string' &&
    (typeof o.coverPath === 'string' || o.coverPath === null) &&
    (typeof o.addedAt === 'string' || typeof o.addedAt === 'number') &&
    typeof o.durationSec === 'number'
  )
}

export async function loadLibraryManifest(): Promise<PersistedTrack[]> {
  if (!isPersistenceAvailable()) return []
  try {
    if (!(await exists(MANIFEST_PATH, { baseDir: APPDATA }))) return []
    const text = await readTextFile(MANIFEST_PATH, { baseDir: APPDATA })
    if (!text.trim()) return []
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) {
      console.warn('[persistence] library.json не массив')
      return []
    }
    const valid: PersistedTrack[] = []
    for (const entry of parsed) {
      if (!isValidPersistedTrack(entry)) {
        console.warn('[persistence] пропущена битая запись:', entry)
        continue
      }
      const e = entry as unknown as Record<string, unknown>
      const orig =
        typeof e.originalFileName === 'string' && e.originalFileName.trim()
          ? e.originalFileName.trim()
          : null
      const szRaw = e.sourceFileSize
      const sourceFileSize =
        typeof szRaw === 'number' && Number.isFinite(szRaw) ? szRaw : null
      valid.push({
        id: e.id as string,
        title: e.title as string,
        artist: e.artist as string,
        album: typeof e.album === 'string' ? e.album : '',
        originalFileName: orig,
        sourceFileSize,
        audioPath: e.audioPath as string,
        coverPath: e.coverPath as string | null,
        features: (e.features as TrackFeatures | null) ?? null,
        moodWeights: (e.moodWeights as MoodWeights | null) ?? null,
        addedAt:
          typeof e.addedAt === 'string' ? e.addedAt : new Date(Number(e.addedAt)).toISOString(),
        durationSec: e.durationSec as number,
      })
    }
    return valid
  } catch (err) {
    console.warn('[persistence] чтение library.json упало:', err)
    return []
  }
}

let writeChain: Promise<void> = Promise.resolve()

export async function saveLibraryManifest(tracks: PersistedTrack[]): Promise<void> {
  if (!isPersistenceAvailable()) return
  const job = async (): Promise<void> => {
    try {
      await ensureLibraryDirs()
      const json = JSON.stringify(tracks, null, 2)
      await writeTextFile(MANIFEST_TMP, json, { baseDir: APPDATA })
      if (await exists(MANIFEST_PATH, { baseDir: APPDATA })) {
        await remove(MANIFEST_PATH, { baseDir: APPDATA })
      }
      await rename(MANIFEST_TMP, MANIFEST_PATH, {
        oldPathBaseDir: APPDATA,
        newPathBaseDir: APPDATA,
      })
    } catch (err) {
      console.warn('[persistence] запись library.json упала:', err)
      throw err
    }
  }
  writeChain = writeChain.then(job, job)
  return writeChain
}

async function removeIfExists(path: string): Promise<void> {
  if (!isPersistenceAvailable()) return
  try {
    if (await exists(path, { baseDir: APPDATA })) {
      await remove(path, { baseDir: APPDATA })
    }
  } catch (err) {
    console.warn('[persistence] не удалось удалить', path, err)
  }
}

const KNOWN_AUDIO_EXTS = ['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'opus']
const KNOWN_COVER_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']

export async function deleteTrackFiles(trackId: string): Promise<void> {
  if (!isPersistenceAvailable()) return
  for (const ext of KNOWN_AUDIO_EXTS) {
    await removeIfExists(`${ROOT}/tracks/${trackId}.${ext}`)
  }
  for (const ext of KNOWN_COVER_EXTS) {
    await removeIfExists(`${ROOT}/covers/${trackId}.${ext}`)
  }
}

export async function loadTrackBytes(audioPath: string): Promise<Uint8Array> {
  if (!isPersistenceAvailable()) {
    throw new Error('Persistence unavailable')
  }
  const full = `${ROOT}/${audioPath}`
  const bytes = await readFile(full, { baseDir: APPDATA })
  return bytes
}

export async function loadTrackBlob(audioPath: string, mime = 'audio/mpeg'): Promise<Blob> {
  const bytes = await loadTrackBytes(audioPath)
  return new Blob([bytes as BlobPart], { type: mime })
}

export async function loadCoverBytes(coverPath: string): Promise<Uint8Array> {
  if (!isPersistenceAvailable()) {
    throw new Error('Persistence unavailable')
  }
  const full = `${ROOT}/${coverPath}`
  return readFile(full, { baseDir: APPDATA })
}

export async function loadCoverObjectUrl(coverPath: string): Promise<string> {
  if (!isPersistenceAvailable()) {
    throw new Error('Persistence unavailable')
  }
  const full = `${ROOT}/${coverPath}`
  const bytes = await readFile(full, { baseDir: APPDATA })
  const mime = coverMimeFromPath(coverPath)
  const blob = new Blob([bytes as BlobPart], { type: mime })
  return URL.createObjectURL(blob)
}

function coverMimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'png': return 'image/png'
    case 'webp': return 'image/webp'
    case 'gif': return 'image/gif'
    case 'bmp': return 'image/bmp'
    default: return 'image/jpeg'
  }
}

export function audioMimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'flac': return 'audio/flac'
    case 'wav': return 'audio/wav'
    case 'm4a': return 'audio/mp4'
    case 'aac': return 'audio/aac'
    case 'ogg': return 'audio/ogg'
    case 'opus': return 'audio/opus'
    default: return 'audio/mpeg'
  }
}
