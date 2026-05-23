import { create } from 'zustand'
import * as mm from 'music-metadata-browser'
import { analyzeMeyda, type TrackFeatures } from '../audio/meydaAnalyzer'
import { computeMoodWeights, type MoodWeights } from '../audio/moodEngine'
import {
  saveTrackFiles,
  deleteTrackFiles,
  loadLibraryManifest,
  saveLibraryManifest,
  loadCoverObjectUrl,
  loadTrackBytes,
  isPersistenceAvailable,
  type PersistedTrack,
} from '../library/persistence'

export interface LibraryTrack {
  id: string
  file?: File
  name: string
  artist: string
  album: string
  cover: string | null
  duration: number
  addedAt: number
  audioPath: string | null
  coverPath: string | null
  features?: TrackFeatures
  moodWeights?: MoodWeights
  isAnalyzing?: boolean
  analyzeFailed?: boolean
}

interface LibraryStore {
  tracks: LibraryTrack[]
  currentTrackId: string | null
  isLoadingFromDisk: boolean
  addTrack: (file: File) => Promise<LibraryTrack>
  removeTrack: (id: string) => Promise<void>
  clearAll: () => Promise<void>
  setCurrentTrack: (id: string | null) => void
  setTrackFeatures: (trackId: string, features: TrackFeatures) => void
  loadLibraryFromDisk: () => Promise<void>
  persistManifest: () => Promise<void>
  getNextTrack: () => LibraryTrack | null
  getPrevTrack: () => LibraryTrack | null
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

interface ParsedMetadata {
  title: string
  artist: string
  album: string
  duration: number
  coverBlob: Blob | null
  coverObjectUrl: string | null
}

async function parseFileMetadata(file: File): Promise<ParsedMetadata> {
  const fallbackName = file.name.replace(/\.[^/.]+$/, '')
  let coverBlob: Blob | null = null
  let coverObjectUrl: string | null = null

  let metadata: Awaited<ReturnType<typeof mm.parseBlob>> | undefined
  try { metadata = await mm.parseBlob(file) } catch {}

  const picture = metadata?.common.picture?.[0]
  if (picture) {
    coverBlob = new Blob([picture.data as BlobPart], { type: picture.format })
    coverObjectUrl = URL.createObjectURL(coverBlob)
  }

  return {
    title: metadata?.common.title || fallbackName,
    artist: metadata?.common.artist || 'Unknown',
    album: metadata?.common.album || '',
    duration: metadata?.format.duration || 0,
    coverBlob,
    coverObjectUrl,
  }
}

function updateTrack(id: string, patch: Partial<LibraryTrack>): void {
  useLibraryStore.setState((s) => ({
    tracks: s.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  }))
}

function trackToPersisted(t: LibraryTrack): PersistedTrack {
  return {
    id: t.id,
    title: t.name,
    artist: t.artist,
    album: t.album,
    audioPath: t.audioPath ?? '',
    coverPath: t.coverPath,
    features: t.features ?? null,
    moodWeights: t.moodWeights ?? null,
    addedAt: new Date(t.addedAt).toISOString(),
    durationSec: t.duration,
  }
}

async function persistCurrentManifest(): Promise<void> {
  if (!isPersistenceAvailable()) return
  const all = useLibraryStore.getState().tracks
  const valid = all.filter((t) => t.audioPath !== null)
  try {
    await saveLibraryManifest(valid.map(trackToPersisted))
  } catch (err) {
    console.warn('[library] не удалось сохранить манифест:', err)
  }
}

let analyzeChain: Promise<void> = Promise.resolve()

function enqueueAnalysis(trackId: string): void {
  analyzeChain = analyzeChain.then(async () => {
    const exists = useLibraryStore.getState().tracks.find((t) => t.id === trackId)
    if (!exists || exists.features) return

    updateTrack(trackId, { isAnalyzing: true })

    let ctx: AudioContext | null = null
    try {
      const arrayBuf = await readTrackArrayBuffer(exists)
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new AC()
      const audioBuffer = await ctx.decodeAudioData(arrayBuf)
      const features = await analyzeMeyda(audioBuffer)
      updateTrack(trackId, { features, moodWeights: computeMoodWeights(features), isAnalyzing: false, analyzeFailed: false })
      void persistCurrentManifest()
    } catch (err) {
      console.warn('[library] анализ упал для', exists.name, err)
      updateTrack(trackId, { isAnalyzing: false, analyzeFailed: true })
    } finally {
      if (ctx) try { await ctx.close() } catch {}
    }
  })
}

async function readTrackArrayBuffer(track: LibraryTrack): Promise<ArrayBuffer> {
  if (track.file) return await track.file.arrayBuffer()
  if (track.audioPath && isPersistenceAvailable()) {
    const bytes = await loadTrackBytes(track.audioPath)
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  }
  throw new Error('Трек не имеет источника аудио')
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  tracks: [],
  currentTrackId: null,
  isLoadingFromDisk: false,

  addTrack: async (file) => {
    const byFile = get().tracks.find(
      (t) => t.file && t.file.name === file.name && t.file.size === file.size,
    )
    if (byFile) return byFile

    const id = makeId()
    const meta = await parseFileMetadata(file)

    const byMeta = get().tracks.find(
      (t) =>
        t.name === meta.title &&
        t.artist === meta.artist &&
        Math.abs(t.duration - meta.duration) < 0.5,
    )
    if (byMeta) {
      if (meta.coverObjectUrl) URL.revokeObjectURL(meta.coverObjectUrl)
      return byMeta
    }

    let audioPath: string | null = null
    let coverPath: string | null = null
    if (isPersistenceAvailable()) {
      try {
        const saved = await saveTrackFiles(file, meta.coverBlob, id)
        audioPath = saved.audioPath
        coverPath = saved.coverPath
      } catch (err) {
        console.warn('[library] не удалось сохранить файлы трека:', err)
      }
    }

    const track: LibraryTrack = {
      id,
      file,
      name: meta.title,
      artist: meta.artist,
      album: meta.album,
      cover: meta.coverObjectUrl,
      duration: meta.duration,
      addedAt: Date.now(),
      audioPath,
      coverPath,
    }

    set((s) => ({ tracks: [...s.tracks, track] }))
    void persistCurrentManifest()
    enqueueAnalysis(id)
    return track
  },

  removeTrack: async (id) => {
    const target = get().tracks.find((t) => t.id === id)
    if (!target) return
    if (target.cover?.startsWith('blob:')) URL.revokeObjectURL(target.cover)
    set((s) => ({
      tracks: s.tracks.filter((t) => t.id !== id),
      currentTrackId: s.currentTrackId === id ? null : s.currentTrackId,
    }))
    if (isPersistenceAvailable()) await deleteTrackFiles(id)
    void persistCurrentManifest()
  },

  clearAll: async () => {
    const all = get().tracks
    for (const t of all) {
      if (t.cover?.startsWith('blob:')) URL.revokeObjectURL(t.cover)
    }
    set({ tracks: [], currentTrackId: null })
    if (isPersistenceAvailable()) {
      for (const t of all) await deleteTrackFiles(t.id)
    }
    void persistCurrentManifest()
  },

  setCurrentTrack: (id) => set({ currentTrackId: id }),

  setTrackFeatures: (trackId, features) =>
    updateTrack(trackId, { features, moodWeights: computeMoodWeights(features), isAnalyzing: false }),

  loadLibraryFromDisk: async () => {
    if (!isPersistenceAvailable()) return
    if (get().isLoadingFromDisk) return
    set({ isLoadingFromDisk: true })

    for (const t of get().tracks) {
      if (t.cover && t.cover.startsWith('blob:')) URL.revokeObjectURL(t.cover)
    }

    try {
      const manifest = await loadLibraryManifest()
      const restored: LibraryTrack[] = []
      for (const p of manifest) {
        let coverUrl: string | null = null
        if (p.coverPath) {
          try {
            coverUrl = await loadCoverObjectUrl(p.coverPath)
          } catch (err) {
            console.warn('[library] обложка недоступна для', p.id, err)
          }
        }
        let addedAtMs = Date.parse(p.addedAt)
        if (!Number.isFinite(addedAtMs)) addedAtMs = Date.now()
        restored.push({
          id: p.id,
          name: p.title,
          artist: p.artist,
          album: p.album,
          cover: coverUrl,
          duration: p.durationSec,
          addedAt: addedAtMs,
          audioPath: p.audioPath,
          coverPath: p.coverPath,
          features: p.features ?? undefined,
          moodWeights: p.moodWeights ?? undefined,
        })
      }
      set({ tracks: restored })

      for (const t of restored) {
        if (!t.features) enqueueAnalysis(t.id)
      }
    } catch (err) {
      console.warn('[library] загрузка библиотеки упала:', err)
    } finally {
      set({ isLoadingFromDisk: false })
    }
  },

  persistManifest: async () => {
    await persistCurrentManifest()
  },

  getNextTrack: () => navTrack(get(), 1),
  getPrevTrack: () => navTrack(get(), -1),
}))

function navTrack(state: { tracks: LibraryTrack[]; currentTrackId: string | null }, direction: 1 | -1): LibraryTrack | null {
  const { tracks, currentTrackId } = state
  if (tracks.length === 0) return null
  const idx = currentTrackId ? tracks.findIndex((t) => t.id === currentTrackId) : -1
  const next = idx === -1
    ? (direction === 1 ? 0 : tracks.length - 1)
    : (idx + direction + tracks.length) % tracks.length
  return tracks[next]
}
