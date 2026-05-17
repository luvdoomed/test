import * as mm from 'music-metadata-browser'
import { useAudioStore } from '../store/audioStore'
import { BeatDetector } from './beatDetector'
import { parseLrc } from '../utils/lrcParser'
import { loadTrackBytes, audioMimeFromPath } from '../library/persistence'

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
  private loadCounter = 0

  onTrackEnd: (() => void) | null = null

  private disposeSource(): void {
    if (!this.source) return
    this.source.onended = null
    try { this.source.stop() } catch { /* already stopped */ }
    try { this.source.disconnect() } catch { /* already disconnected */ }
    this.source = null
  }

  private resetAnalysisState(): void {
    this.beatDetector.reset()
    const store = useAudioStore.getState()
    store.setAudioData(new Float32Array(this.dataArray.length))
    store.setEnergy(0)
    store.setBeat(false)
  }

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
    this.disposeSource()
    this.pauseOffset = 0
    this.playing = false
    this.buffer = null
    this.resetAnalysisState()

    const store = useAudioStore.getState()
    store.setLrcLines([])
    store.setIsPlaying(false)
    store.setCurrentTime(0)

    const myLoadId = ++this.loadCounter

    const arrayBuffer = await file.arrayBuffer()
    if (myLoadId !== this.loadCounter) return

    this.originalBytes = new Uint8Array(arrayBuffer.slice(0))
    this.originalExt = file.name.split('.').pop()?.toLowerCase() ?? ''

    const decoded = await this.audioContext.decodeAudioData(arrayBuffer)
    if (myLoadId !== this.loadCounter) return
    this.buffer = decoded

    this.extractTags(file, myLoadId)
    this.startLoop()
  }

  async loadFromPath(audioPath: string): Promise<void> {
    this.disposeSource()
    this.pauseOffset = 0
    this.playing = false
    this.buffer = null
    this.resetAnalysisState()

    const store = useAudioStore.getState()
    store.setLrcLines([])
    store.setIsPlaying(false)
    store.setCurrentTime(0)

    const myLoadId = ++this.loadCounter

    const bytes = await loadTrackBytes(audioPath)
    if (myLoadId !== this.loadCounter) return

    const filename = audioPath.split('/').pop() ?? 'track'
    const ext = filename.split('.').pop()?.toLowerCase() ?? ''
    const mime = audioMimeFromPath(audioPath)

    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

    this.originalBytes = new Uint8Array(arrayBuffer.slice(0))
    this.originalExt = ext

    const decoded = await this.audioContext.decodeAudioData(arrayBuffer.slice(0))
    if (myLoadId !== this.loadCounter) return
    this.buffer = decoded

    const synthFile = new File([new Uint8Array(this.originalBytes)], filename, { type: mime })
    this.extractTags(synthFile, myLoadId)
    this.startLoop()
  }

  private async extractTags(file: File, loadId: number): Promise<void> {
    const fallbackTitle = file.name.replace(/\.[^/.]+$/, '')

    try {
      const metadata = await mm.parseBlob(file)
      if (loadId !== this.loadCounter) return
      const store = useAudioStore.getState()
      const { title, artist, album } = metadata.common
      const picture = metadata.common.picture?.[0]
      let cover = ''

      if (picture) {
        const blob = new Blob([picture.data], { type: picture.format })
        cover = URL.createObjectURL(blob)
      }

      store.setTrackInfo({
        title: title || fallbackTitle,
        artist: artist || '',
        album: album || '',
        cover,
      })

      const lyricsArr = metadata.common.lyrics
      if (lyricsArr?.length) {
        const raw = lyricsArr.filter(Boolean).join('\n')
        if (raw.length > 0 && /\[\d{1,2}:\d{2}/.test(raw)) {
          const parsed = parseLrc(raw)
          if (parsed.length > 0) {
            store.setLrcLines(parsed)
          }
        }
      }
    } catch {
      if (loadId !== this.loadCounter) return
      useAudioStore.getState().setTrackInfo({
        title: fallbackTitle,
        artist: '',
        album: '',
        cover: '',
      })
    }
  }

  play(): void {
    if (!this.buffer || this.playing) return
    this.disposeSource()

    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume()
    }

    this.source = this.audioContext.createBufferSource()
    this.source.buffer = this.buffer
    this.source.connect(this.gainNode)
    this.source.start(0, this.pauseOffset)

    this.startedAt = this.audioContext.currentTime - this.pauseOffset
    this.playing = true

    this.source.onended = () => {
      if (!this.playing) return
      const hook = this.onTrackEnd
      this.stop()
      if (hook) hook()
    }

    useAudioStore.getState().setIsPlaying(true)
    this.startLoop()
  }

  pause(): void {
    if (!this.playing) return

    this.pauseOffset = this.audioContext.currentTime - this.startedAt
    this.disposeSource()
    this.playing = false

    useAudioStore.getState().setIsPlaying(false)
    this.stopLoop()
  }

  stop(): void {
    this.disposeSource()
    this.pauseOffset = 0
    this.playing = false

    useAudioStore.getState().setIsPlaying(false)
    useAudioStore.getState().setCurrentTime(0)
    this.stopLoop()
  }

  seek(time: number): void {
    if (!this.buffer) return
    const clamped = Math.max(0, Math.min(time, this.buffer.duration))

    if (this.playing) {
      this.disposeSource()

      this.source = this.audioContext.createBufferSource()
      this.source.buffer = this.buffer
      this.source.connect(this.gainNode)
      this.source.start(0, clamped)
      this.startedAt = this.audioContext.currentTime - clamped

      this.source.onended = () => {
        if (!this.playing) return
        const hook = this.onTrackEnd
        this.stop()
        if (hook) hook()
      }
    } else {
      this.pauseOffset = clamped
    }

    useAudioStore.getState().setCurrentTime(clamped)
  }

  getDuration(): number {
    return this.buffer?.duration ?? 0
  }

  getAudioBuffer(): AudioBuffer | null {
    return this.buffer
  }

  getOriginalAudioBytes(): Uint8Array | null {
    return this.originalBytes
  }

  getOriginalAudioExt(): string {
    return this.originalExt
  }

  setVolume(value: number): void {
    this.gainNode.gain.setTargetAtTime(value, this.audioContext.currentTime, 0.01)
    useAudioStore.getState().setVolume(value)
  }

  tick(): void {
    this.analyser.getFloatFrequencyData(this.dataArray)

    const normalized = new Float32Array(this.dataArray.length)
    let sum = 0
    for (let i = 0; i < this.dataArray.length; i++) {
      // dbfs [-inf, 0] клип до [-100, 0] и норм в [0, 1]
      const v = Math.max(0, (this.dataArray[i] + 100) / 100)
      normalized[i] = v
      sum += v
    }

    const energy = sum / this.dataArray.length
    const beat = this.beatDetector.detect(normalized)

    const store = useAudioStore.getState()
    store.setAudioData(normalized)
    store.setEnergy(energy)
    store.setBeat(beat)

    if (this.playing) {
      store.setCurrentTime(this.audioContext.currentTime - this.startedAt)
    }
  }

  destroy(): void {
    this.stop()
    void this.audioContext.close()
  }
}

export const audioEngine = new AudioEngine()
