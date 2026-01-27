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
}
