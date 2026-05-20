import { create } from 'zustand'
import { audioEngine } from '../audio/audioEngine'
import { useAudioStore } from './audioStore'
import { useUIStore, type LibraryView } from './uiStore'

const STORAGE_KEY = 'mv_app_settings_v1'

export interface AppSettings {
  libraryView: LibraryView
  karaokeOnLyricsLoaded: boolean
  autoSearchLyrics: boolean
  /** 0…1 */
  defaultVolume: number
  exportIncludeKaraoke: boolean
}

const DEFAULTS: AppSettings = {
  libraryView: 'list',
  karaokeOnLyricsLoaded: false,
  autoSearchLyrics: true,
  defaultVolume: 1,
  exportIncludeKaraoke: false,
}

function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return DEFAULTS.defaultVolume
  return Math.max(0, Math.min(1, v))
}

function readStoredSettings(): AppSettings {
  if (typeof window === 'undefined') return { ...DEFAULTS }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const o = JSON.parse(raw) as Partial<AppSettings>
    return {
      libraryView: o.libraryView === 'grid' ? 'grid' : 'list',
      karaokeOnLyricsLoaded: Boolean(o.karaokeOnLyricsLoaded),
      autoSearchLyrics: o.autoSearchLyrics !== false,
      defaultVolume: clampVolume(o.defaultVolume ?? DEFAULTS.defaultVolume),
      exportIncludeKaraoke: Boolean(o.exportIncludeKaraoke),
    }
  } catch {
    return { ...DEFAULTS }
  }
}

function persistSettings(state: AppSettings) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    void import('../services/cloudSync').then((m) => m.scheduleCloudPush('settings'))
  } catch {
    /* квота / приватный режим */
  }
}

function pickAppSettings(s: SettingsStore): AppSettings {
  return {
    libraryView: s.libraryView,
    karaokeOnLyricsLoaded: s.karaokeOnLyricsLoaded,
    autoSearchLyrics: s.autoSearchLyrics,
    defaultVolume: s.defaultVolume,
    exportIncludeKaraoke: s.exportIncludeKaraoke,
  }
}

interface SettingsStore extends AppSettings {
  setLibraryView: (v: LibraryView) => void
  setKaraokeOnLyricsLoaded: (v: boolean) => void
  setAutoSearchLyrics: (v: boolean) => void
  setDefaultVolume: (v: number) => void
  setExportIncludeKaraoke: (v: boolean) => void
}

const initial = readStoredSettings()

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...initial,

  setLibraryView: (v) => {
    set({ libraryView: v })
    persistSettings({ ...pickAppSettings(get()), libraryView: v })
    useUIStore.getState().setLibraryView(v)
  },

  setKaraokeOnLyricsLoaded: (v) => {
    set({ karaokeOnLyricsLoaded: v })
    persistSettings({ ...pickAppSettings(get()), karaokeOnLyricsLoaded: v })
    if (v) maybeEnableKaraokeOverlay()
  },

  setAutoSearchLyrics: (v) => {
    set({ autoSearchLyrics: v })
    persistSettings({ ...pickAppSettings(get()), autoSearchLyrics: v })
  },

  setDefaultVolume: (v) => {
    const vol = clampVolume(v)
    set({ defaultVolume: vol })
    persistSettings({ ...pickAppSettings(get()), defaultVolume: vol })
    audioEngine.setVolume(vol)
  },

  setExportIncludeKaraoke: (v) => {
    set({ exportIncludeKaraoke: v })
    persistSettings({ ...pickAppSettings(get()), exportIncludeKaraoke: v })
  },
}))

/** включить overlay, если в настройках так задано и текст уже есть */
export function maybeEnableKaraokeOverlay(): void {
  if (!useSettingsStore.getState().karaokeOnLyricsLoaded) return
  if (useAudioStore.getState().lrcLines.length === 0) return
  useUIStore.getState().setKaraokeOverlay(true)
}

/** синхронизация uiStore и громкости при старте приложения */
export function applyStoredSettingsOnStartup(): void {
  const s = useSettingsStore.getState()
  useUIStore.getState().setLibraryView(s.libraryView)
  audioEngine.setVolume(s.defaultVolume)
}
