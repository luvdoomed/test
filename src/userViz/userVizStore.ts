import { create } from 'zustand'
import type { MoodId } from '../audio/moodEngine'
import type { UserVisualizerMeta, UserVisualizerRuntime } from './types'
import { compileUserViz } from './compiler'
import {
  saveUserVizFile,
  readUserVizFile,
  deleteUserVizFile,
  loadUserVizManifest,
  saveUserVizManifest,
  isUserVizPersistenceAvailable,
} from './storage'

const ID_PREFIX = 'user-'

export function makeUserVizId(): string {
  const raw =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  return `${ID_PREFIX}${raw}`
}

export function isUserVizId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(ID_PREFIX)
}

interface UserVizState {
  visualizers: UserVisualizerRuntime[]
  isLoading: boolean
  loadFromDisk: () => Promise<void>
  addVisualizer: (file: File, name: string, moods: MoodId[]) => Promise<UserVisualizerRuntime>
  removeVisualizer: (vizId: string) => Promise<void>
  recompileVisualizer: (vizId: string) => Promise<void>
  getById: (vizId: string) => UserVisualizerRuntime | undefined
}

function metaFromRuntime(r: UserVisualizerRuntime): UserVisualizerMeta {
  return {
    id: r.id,
    name: r.name,
    moods: r.moods,
    sourcePath: r.sourcePath,
    createdAt: r.createdAt,
  }
}

async function persistCurrentManifest(): Promise<void> {
  if (!isUserVizPersistenceAvailable()) return
  const all = useUserVizStore.getState().visualizers
  try {
    await saveUserVizManifest(all.map(metaFromRuntime))
    const { scheduleCloudPush } = await import('../services/cloudSync')
    scheduleCloudPush('user-viz')
  } catch (err) {
    console.warn('[userViz] не удалось сохранить манифест:', err)
  }
}

export const useUserVizStore = create<UserVizState>((set, get) => ({
  visualizers: [],
  isLoading: false,

  loadFromDisk: async () => {
    if (!isUserVizPersistenceAvailable()) return
    if (get().isLoading) return
    set({ isLoading: true })
    try {
      const metas = await loadUserVizManifest()
      const restored: UserVisualizerRuntime[] = []
      for (const m of metas) {
        let component = null
        let error: string | null = null
        try {
          const source = await readUserVizFile(m.sourcePath)
          const compiled = compileUserViz(source)
          component = compiled.component
          error = compiled.error
        } catch (err) {
          error = err instanceof Error ? err.message : String(err)
        }
        restored.push({ ...m, component, error })
      }
      set({ visualizers: restored })
    } catch (err) {
      console.warn('[userViz] loadFromDisk упал:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  addVisualizer: async (file, name, moods) => {
    const source = await file.text()
    const compiled = compileUserViz(source)
    if (!compiled.component) {
      throw new Error(compiled.error ?? 'Не удалось скомпилировать')
    }

    const id = makeUserVizId()
    let sourcePath = ''
    if (isUserVizPersistenceAvailable()) {
      try {
        sourcePath = await saveUserVizFile(id, source)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        throw new Error(`Не удалось сохранить файл: ${msg}`)
      }
    } else {
      sourcePath = `visualizers/${id}.tsx`
    }

    const runtime: UserVisualizerRuntime = {
      id,
      name: name.trim() || 'Без названия',
      moods,
      sourcePath,
      createdAt: new Date().toISOString(),
      component: compiled.component,
      error: null,
    }

    set((s) => ({ visualizers: [...s.visualizers, runtime] }))
    void persistCurrentManifest()
    return runtime
  },

  removeVisualizer: async (vizId) => {
    const target = get().visualizers.find((v) => v.id === vizId)
    if (!target) return
    set((s) => ({ visualizers: s.visualizers.filter((v) => v.id !== vizId) }))
    if (isUserVizPersistenceAvailable()) {
      try {
        await deleteUserVizFile(target.sourcePath)
      } catch (err) {
        console.warn('[userViz] не удалось удалить файл:', err)
      }
    }
    void persistCurrentManifest()
  },

  recompileVisualizer: async (vizId) => {
    const target = get().visualizers.find((v) => v.id === vizId)
    if (!target) return
    try {
      const source = await readUserVizFile(target.sourcePath)
      const compiled = compileUserViz(source)
      set((s) => ({
        visualizers: s.visualizers.map((v) =>
          v.id === vizId
            ? { ...v, component: compiled.component, error: compiled.error }
            : v,
        ),
      }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      set((s) => ({
        visualizers: s.visualizers.map((v) =>
          v.id === vizId ? { ...v, component: null, error: msg } : v,
        ),
      }))
    }
  },

  getById: (vizId) => get().visualizers.find((v) => v.id === vizId),
}))
