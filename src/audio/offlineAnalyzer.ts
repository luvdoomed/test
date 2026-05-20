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

  for (let f = 0; f < totalFrames; f++) {
    const start = Math.floor(f * hopSize)

    for (let i = 0; i < fftSize; i++) {
      const idx = start + i
      const s = idx < length ? mono[idx] : 0
      frame[i] = s * window[i]
    }

    fft.realTransform(out, frame)

    // магнитуда, дБ нормализация [0,1] как в audioEngine.tick
    const snapshot = new Float32Array(BINS)
    let sum = 0
    for (let k = 0; k < BINS; k++) {
      const re = out[2 * k]
      const im = out[2 * k + 1]
      const magRaw = Math.sqrt(re * re + im * im) / fftSize
      const mag = magRaw > 1e-10 ? magRaw : 1e-10
      const db = 20 * Math.log10(mag)
      const v = Math.max(0, (db + DB_CLAMP) / DB_CLAMP)
      snapshot[k] = v
      sum += v
    }

    snapshots[f] = snapshot
    energies[f] = sum / BINS
    beats[f] = detector.detect(snapshot)
  }

  return { snapshots, energies, beats, totalFrames, fps }
}

export async function testOfflineAnalyzer(audioBuffer: AudioBuffer): Promise<OfflineAnalysis> {
  const fps = 60
  console.log(
    `[offlineAnalyzer] анализ: ${audioBuffer.duration.toFixed(2)}с, `
    + `${audioBuffer.sampleRate}Гц, ${audioBuffer.numberOfChannels}ch`,
  )

  const t0 = performance.now()
  const result = await analyzeOffline(audioBuffer, fps)
  const t1 = performance.now()

  console.log(`[offlineAnalyzer] готово за ${(t1 - t0).toFixed(0)}мс, кадров: ${result.totalFrames}`)
  console.log(
    '[offlineAnalyzer] первые 10 energies:',
    result.energies.slice(0, 10).map((v) => v.toFixed(4)),
  )
  console.log('[offlineAnalyzer] первые 10 beats:', result.beats.slice(0, 10))

  const beatCount = result.beats.filter(Boolean).length
  const firstBeatMoments: string[] = []
  for (let i = 0; i < result.beats.length && firstBeatMoments.length < 10; i++) {
    if (result.beats[i] && (i === 0 || !result.beats[i - 1])) {
      firstBeatMoments.push(`#${i} (${(i / fps).toFixed(2)}с)`)
    }
  }
  console.log(`[offlineAnalyzer] всего кадров с beat=true: ${beatCount}`)
  console.log('[offlineAnalyzer] первые 10 начал битов:', firstBeatMoments)

  return result
}
