import * as mm from 'music-metadata-browser'
import { useAudioStore } from '../store/audioStore'
import { BeatDetector } from './beatDetector'
import { parseLrc } from '../utils/lrcParser'

export class AudioEngine {
  audioContext: AudioContext
  analyser: AnalyserNode
  source: AudioBufferSourceNode | null = null
  gainNode: GainNode
  dataArray: Float32Array

  private beatDetector = new BeatDetector()
  private buffer: AudioBuffer | null = null
  private originalBytes: Uint8Array | null = null
  private originalExt = ''
  private startedAt = 0
}
