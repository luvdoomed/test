import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export interface SystemCaptureInfo {
  sampleRate: number
  channels: number
}

interface SamplesPayload {
  samples: number[]
  timestamp: number
}

const FFT_SIZE = 2048
const BIN_COUNT = 1024
const RING_SIZE = 8192

const ringBuffer = new Float32Array(RING_SIZE)
let writeIdx = 0
let writtenTotal = 0

const fftReal = new Float32Array(FFT_SIZE)
const fftImag = new Float32Array(FFT_SIZE)
const hannWindow = new Float32Array(FFT_SIZE)
for (let i = 0; i < FFT_SIZE; i++) {
  hannWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)))
}

let unlisten: UnlistenFn | null = null
let capturing = false
let lastAudioData = new Float32Array(BIN_COUNT)
let lastEnergy = 0

function resetBuffers(): void {
  writeIdx = 0
  writtenTotal = 0
  ringBuffer.fill(0)
  lastAudioData = new Float32Array(BIN_COUNT)
  lastEnergy = 0
}

function pushSamples(samples: number[]): void {
  for (let i = 0; i < samples.length; i++) {
    ringBuffer[writeIdx] = samples[i]
    writeIdx = (writeIdx + 1) % RING_SIZE
    writtenTotal++
  }
}

function fftRadix2(real: Float32Array, imag: Float32Array): void {
  const n = real.length
  let j = 0
  for (let i = 1; i < n; i++) {
    let bit = n >> 1
    for (; (j & bit) !== 0; bit >>= 1) {
      j ^= bit
    }
    j ^= bit
    if (i < j) {
      const tr = real[i]
      real[i] = real[j]
      real[j] = tr
      const ti = imag[i]
      imag[i] = imag[j]
      imag[j] = ti
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1
    const ang = (-2 * Math.PI) / len
    const wReal = Math.cos(ang)
    const wImag = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let wr = 1
      let wi = 0
      for (let k = 0; k < half; k++) {
        const a = i + k
        const b = a + half
        const tr = wr * real[b] - wi * imag[b]
        const ti = wr * imag[b] + wi * real[b]
        real[b] = real[a] - tr
        imag[b] = imag[a] - ti
        real[a] += tr
        imag[a] += ti
        const nwr = wr * wReal - wi * wImag
        wi = wr * wImag + wi * wReal
        wr = nwr
      }
    }
  }
}

export async function startSystemCapture(): Promise<SystemCaptureInfo> {
  if (capturing || unlisten) {
    await stopSystemCapture()
  }
  resetBuffers()

  const fn = await listen<SamplesPayload>('system-audio-samples', (event) => {
    const payload = event.payload
    if (!payload || !payload.samples) return
    pushSamples(payload.samples)
  })
  unlisten = fn

  try {
    const info = await invoke<SystemCaptureInfo>('start_system_capture')
    capturing = true
    return info
  } catch (err) {
    if (unlisten) {
      unlisten()
      unlisten = null
    }
    throw err
  }
}

export async function stopSystemCapture(): Promise<void> {
  capturing = false
  if (unlisten) {
    unlisten()
    unlisten = null
  }
  try {
    await invoke<string>('stop_system_capture')
  } catch (err) {
    console.warn('[systemAudioCapture] stop_system_capture failed:', err)
  }
  resetBuffers()
}

export function processSystemAudioFrame(): { audioData: Float32Array; energy: number } {
  if (!capturing || writtenTotal < FFT_SIZE) {
    return { audioData: lastAudioData, energy: lastEnergy }
  }

  const readStart = (writeIdx - FFT_SIZE + RING_SIZE) % RING_SIZE
  for (let i = 0; i < FFT_SIZE; i++) {
    fftReal[i] = ringBuffer[(readStart + i) % RING_SIZE] * hannWindow[i]
    fftImag[i] = 0
  }

  fftRadix2(fftReal, fftImag)

  const out = new Float32Array(BIN_COUNT)
  let sum = 0
  const norm = 1 / FFT_SIZE
  for (let i = 0; i < BIN_COUNT; i++) {
    const re = fftReal[i]
    const im = fftImag[i]
    const mag = Math.sqrt(re * re + im * im) * norm
    const db = 20 * Math.log10(Math.max(1e-10, mag))
    const v = Math.max(0, (db + 100) / 100)
    out[i] = v
    sum += v
  }

  lastAudioData = out
  lastEnergy = sum / BIN_COUNT
  return { audioData: out, energy: lastEnergy }
}

export function getCapturedAudioData(): Float32Array {
  return lastAudioData
}

export function getCapturedEnergy(): number {
  return lastEnergy
}

export function isSystemCapturing(): boolean {
  return capturing
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (capturing) {
      void invoke('stop_system_capture').catch(() => {})
    }
  })
}
