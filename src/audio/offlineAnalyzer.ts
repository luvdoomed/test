import FFT from 'fft.js'
import { BeatDetector } from './beatDetector'

const BINS = 1024
const DEFAULT_FFT_SIZE = 2048
const DB_CLAMP = 100

export interface OfflineAnalysis {
  snapshots: Float32Array[]
  energies: number[]
  beats: boolean[]
  totalFrames: number
  fps: number
}

export async function analyzeOffline(
  audioBuffer: AudioBuffer,
  fps: number,
  fftSize: number = DEFAULT_FFT_SIZE,
): Promise<OfflineAnalysis> {
  if (fftSize < 2 || (fftSize & (fftSize - 1)) !== 0) {
    throw new Error('fftSize должен быть степенью двойки')
  }
  if (fftSize / 2 < BINS) {
    throw new Error(`fftSize слишком мал: нужно минимум ${BINS * 2} для ${BINS} бинов`)
  }
  if (fps <= 0) throw new Error('fps должен быть положительным')

  const sampleRate = audioBuffer.sampleRate
  const length = audioBuffer.length
  const channels = audioBuffer.numberOfChannels
  const totalFrames = Math.max(1, Math.ceil(audioBuffer.duration * fps))
  const hopSize = sampleRate / fps

  // моно микс — среднее по каналам
  const mono = new Float32Array(length)
  if (channels === 1) {
    mono.set(audioBuffer.getChannelData(0))
  } else {
    for (let ch = 0; ch < channels; ch++) {
      const data = audioBuffer.getChannelData(ch)
      for (let i = 0; i < length; i++) mono[i] += data[i]
    }
    const inv = 1 / channels
    for (let i = 0; i < length; i++) mono[i] *= inv
  }

  const window = new Float32Array(fftSize)
  for (let i = 0; i < fftSize; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)))
  }

  const fft = new FFT(fftSize)
  const frame = new Float64Array(fftSize)
  const out = fft.createComplexArray() as number[]

  const snapshots: Float32Array[] = new Array(totalFrames)
  const energies: number[] = new Array(totalFrames)
  const beats: boolean[] = new Array(totalFrames)

  const detector = new BeatDetector({
    historySize: Math.max(8, Math.round(43 * (fps / 60))),
    beatHold: Math.max(2, Math.round(22 * (fps / 60))),
  })
}
