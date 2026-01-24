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
    this.buffer = await this.audioContext.decodeAudioData(arrayBuffer)

    useAudioStore.getState().setLrcLines([])
    useAudioStore.getState().setIsPlaying(false)
    useAudioStore.getState().setCurrentTime(0)
    this.pauseOffset = 0
    this.playing = false

    this.extractTags(file)

    this.startLoop()
  }

  private async extractTags(file: File): Promise<void> {
    const fallbackTitle = file.name.replace(/\.[^/.]+$/, '')
    const store = useAudioStore.getState()

    try {
      const metadata = await mm.parseBlob(file)
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
      store.setTrackInfo({
        title: fallbackTitle,
        artist: '',
}}}}
)
]
