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
}
