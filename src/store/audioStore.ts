import { create } from 'zustand'
import type { LrcLine } from '../utils/lrcParser'
import type { MoodId } from '../audio/moodEngine'
import { audioEngine } from '../audio/audioEngine'
import { startSystemCapture, stopSystemCapture } from '../audio/systemAudioCapture'

interface TrackInfo {
  title: string
  artist: string
  album: string
  cover: string
}

export type AudioMode = 'file' | 'system'

export interface MoodSession {
  playlistQueue: string[]
  currentTrackId: string | null
  currentTrackPosition: number
  currentVizId: string | null
  avoidedVizIds: string[]
  lastPickedForTrack: string | null
}

export const EMPTY_MOOD_SESSION: MoodSession = {
  playlistQueue: [],
  currentTrackId: null,
  currentTrackPosition: 0,
  currentVizId: null,
  avoidedVizIds: [],
  lastPickedForTrack: null,
}

interface AudioState {
  audioData: Float32Array
  beat: boolean
  energy: number
  currentTime: number
  trackInfo: TrackInfo
  isPlaying: boolean
  volume: number
  lrcLines: LrcLine[]
  playlistQueue: string[]
  currentPlaylistMood: MoodId | null
  audioMode: AudioMode
  moodSessions: Partial<Record<MoodId, MoodSession>>

  setAudioData: (data: Float32Array) => void
  setBeat: (beat: boolean) => void
  setEnergy: (energy: number) => void
  setCurrentTime: (time: number) => void
  setTrackInfo: (info: TrackInfo) => void
  setIsPlaying: (playing: boolean) => void
  setVolume: (volume: number) => void
  setLrcLines: (lines: LrcLine[]) => void
  setPlaylistQueue: (trackIds: string[], mood: MoodId | null) => void
  clearPlaylistQueue: () => void
  setAudioMode: (mode: AudioMode) => Promise<void>
  updateMoodSession: (mood: MoodId, patch: Partial<MoodSession>) => void
}

export const useAudioStore = create<AudioState>((set, get) => ({
  audioData: new Float32Array(),
  beat: false,
  energy: 0,
  currentTime: 0,
  trackInfo: { title: '', artist: '', album: '', cover: '' },
  isPlaying: false,
  volume: 1,
  lrcLines: [],
  playlistQueue: [],
  currentPlaylistMood: null,
  audioMode: 'file',
  moodSessions: {},

  setAudioData: (data) => set({ audioData: data }),
  setBeat: (beat) => set({ beat }),
  setEnergy: (energy) => set({ energy }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setTrackInfo: (info) => set({ trackInfo: info }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => set({ volume }),
  setLrcLines: (lines) => set({ lrcLines: lines }),
  setPlaylistQueue: (trackIds, mood) => set({ playlistQueue: trackIds, currentPlaylistMood: mood }),
  clearPlaylistQueue: () => set({ playlistQueue: [], currentPlaylistMood: null }),

  updateMoodSession: (mood, patch) =>
    set((s) => {
      const prev = s.moodSessions[mood] ?? EMPTY_MOOD_SESSION
      return { moodSessions: { ...s.moodSessions, [mood]: { ...prev, ...patch } } }
    }),

  setAudioMode: async (mode) => {
    const current = get().audioMode
    if (current === mode) return

    if (mode === 'system') {
      audioEngine.pause()
      set({
        audioMode: 'system',
        trackInfo: { title: 'Системный звук', artist: '', album: '', cover: '' },
        audioData: new Float32Array(1024),
        energy: 0,
        beat: false,
        currentTime: 0,
        isPlaying: true,
      })
      try {
        await startSystemCapture()
        audioEngine.markSystemStart()
        audioEngine.stopLoop()
        audioEngine.startLoop()
      } catch (err) {
        console.error('[audioMode] startSystemCapture failed:', err)
        set({ audioMode: 'file' })
        throw err
      }
    } else {
      await stopSystemCapture()
      audioEngine.stopLoop()
      set({
        audioMode: 'file',
        audioData: new Float32Array(1024),
        energy: 0,
        beat: false,
        isPlaying: false,
      })
    }
  },
}))