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
  private pauseOffset = 0
  private playing = false
  private rafId: number = 0

  constructor() {
    this.audioContext = new AudioContext()
    this.gainNode = this.audioContext.createGain()
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 2048
    this.dataArray = new Float32Array(1024)
    this.gainNode.connect(this.analyser)
    this.analyser.connect(this.audioContext.destination)
  }

  private loop = (): void => {
    this.tick()
    this.rafId = requestAnimationFrame(this.loop)
  }

  startLoop(): void {
    if (this.rafId) return
    this.loop()
  }

  stopLoop(): void {
    cancelAnimationFrame(this.rafId)
    this.rafId = 0
  }

  async loadFile(file: File): Promise<void> {
    const arrayBuffer = await file.arrayBuffer()
    this.originalBytes = new Uint8Array(arrayBuffer.slice(0))
    this.originalExt = file.name.split('.').pop()?.toLowerCase() ?? ''
}}
