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

type Section = 'verse' | 'chorus' | 'bridge' | 'unknown'

export type AudioMode = 'file' | 'system'

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
  /** Распарсенные строки .lrc (пусто, если текст не загружен). */
  lrcLines: LrcLine[]
  playlistQueue: string[]
  currentPlaylistMood: MoodId | null
  audioMode: AudioMode

  setAudioData: (data: Float32Array) => void
  setBeat: (beat: boolean) => void
  setEnergy: (energy: number) => void
  setSection: (section: Section) => void
  setCurrentLyric: (lyric: string) => void
  setCurrentTime: (time: number) => void
  setTrackInfo: (info: TrackInfo) => void
  setIsPlaying: (playing: boolean) => void
  setVolume: (volume: number) => void
  setLrcLines: (lines: LrcLine[]) => void
  setPlaylistQueue: (trackIds: string[], mood: MoodId | null) => void
  clearPlaylistQueue: () => void
  setAudioMode: (mode: AudioMode) => Promise<void>
}

export const useAudioStore = create<AudioState>((set, get) => ({
  audioData: new Float32Array(),
  beat: false,
  energy: 0,
  section: 'unknown',
  currentLyric: '',
  currentTime: 0,
  trackInfo: { title: '', artist: '', album: '', cover: '' },
  isPlaying: false,
  volume: 1,
  lrcLines: [],
  playlistQueue: [],
  currentPlaylistMood: null,
  audioMode: 'file',

  setAudioData: (data) => set({ audioData: data }),
  setBeat: (beat) => set({ beat }),
  setEnergy: (energy) => set({ energy }),
  setSection: (section) => set({ section }),
  setCurrentLyric: (lyric) => set({ currentLyric: lyric }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setTrackInfo: (info) => set({ trackInfo: info }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => set({ volume }),
  setLrcLines: (lines) => set({ lrcLines: lines }),
  setPlaylistQueue: (trackIds, mood) => set({ playlistQueue: trackIds, currentPlaylistMood: mood }),
  clearPlaylistQueue: () => set({ playlistQueue: [], currentPlaylistMood: null }),

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
        const info = await startSystemCapture()
        console.log('[audioMode] system capture started:', info)
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