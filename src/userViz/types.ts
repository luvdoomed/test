import type { ComponentType } from 'react'
import type { MoodId } from '../audio/moodEngine'
import type { LrcLine } from '../utils/lrcParser'

export interface UserVisualizerMeta {
  id: string
  name: string
  moods: MoodId[]
  sourcePath: string
  createdAt: string
}

export interface UserVizProps {
  audioData: Float32Array
  beat: boolean
  energy: number
  currentTime: number
  
  lrcLines: LrcLine[]
  
  activeLineIndex: number
  
  activeLineText: string
  isPlaying: boolean
}

export interface UserVisualizerRuntime extends UserVisualizerMeta {
  component: ComponentType<UserVizProps> | null
  error: string | null
}
