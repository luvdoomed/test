import { create } from 'zustand'
import type { VibeProfile } from '../profiler/profiler'
import type { LrcLine } from '../utils/lrcParser'

interface TrackInfo {
  title: string
  artist: string
  album: string
  cover: string
}

type Section = 'verse' | 'chorus' | 'bridge' | 'unknown'

export interface SuggestedVisualizer {
  id: string
  distance: number
}

interface AudioState {
  audioData: Float32Array
  beat: boolean
  energy: number
  section: Section
  currentLyric: string
  currentTime: number
  trackInfo: TrackInfo
  isPlaying: boolean
  volume: number
  autoMode: boolean
  trackProfile: VibeProfile | null
  suggestedVisualizers: SuggestedVisualizer[]
  /** Распарсенные строки .lrc (пусто, если текст не загружен). */
  lrcLines: LrcLine[]

  setAudioData: (data: Float32Array) => void
  setBeat: (beat: boolean) => void
  setEnergy: (energy: number) => void
  setSection: (section: Section) => void
  setCurrentLyric: (lyric: string) => void
  setCurrentTime: (time: number) => void
  setTrackInfo: (info: TrackInfo) => void
  setIsPlaying: (playing: boolean) => void
  setVolume: (volume: number) => void
  setAutoMode: (enabled: boolean) => void
  setTrackProfile: (profile: VibeProfile | null) => void
  setSuggestedVisualizers: (list: SuggestedVisualizer[]) => void
  setLrcLines: (lines: LrcLine[]) => void
}

export const useAudioStore = create<AudioState>((set) => ({
  audioData: new Float32Array(),
  beat: false,
  energy: 0,
  section: 'unknown',
  currentLyric: '',
  currentTime: 0,
  trackInfo: { title: '', artist: '', album: '', cover: '' },
  isPlaying: false,
  volume: 1,
}
))
