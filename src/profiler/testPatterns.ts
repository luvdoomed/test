
export interface Frame {
  audioData: Float32Array
  energy: number
  beat: boolean
}

const FFT_SIZE = 1024
const DEFAULT_FRAMES = 120

function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return function random(): number {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function silencePattern(frameCount: number = DEFAULT_FRAMES): Frame[] {
  const frames: Frame[] = []
  for (let i = 0; i < frameCount; i++) {
    frames.push({
      audioData: new Float32Array(FFT_SIZE),
      energy: 0,
      beat: false,
    })
  }
  return frames
}

export function whiteNoisePattern(frameCount: number = DEFAULT_FRAMES): Frame[] {
  const rand = mulberry32(1337)
  const frames: Frame[] = []
  for (let i = 0; i < frameCount; i++) {
    const data = new Float32Array(FFT_SIZE)
    let sum = 0
    for (let k = 0; k < FFT_SIZE; k++) {
      const v = rand() * 0.5
      data[k] = v
      sum += v
    }
    frames.push({
      audioData: data,
      energy: sum / FFT_SIZE,
      beat: false,
    })
  }
  return frames
}

export function bassPattern(frameCount: number = DEFAULT_FRAMES): Frame[] {
  const frames: Frame[] = []
  for (let i = 0; i < frameCount; i++) {
    const data = new Float32Array(FFT_SIZE)
    for (let k = 0; k < 20; k++) data[k] = 0.5
    let sum = 0
    for (let k = 0; k < FFT_SIZE; k++) sum += data[k]
    frames.push({
      audioData: data,
      energy: sum / FFT_SIZE,
      beat: false,
    })
  }
  return frames
}

export function treblePattern(frameCount: number = DEFAULT_FRAMES): Frame[] {
  const frames: Frame[] = []
  for (let i = 0; i < frameCount; i++) {
    const data = new Float32Array(FFT_SIZE)
    for (let k = 80; k < 120; k++) data[k] = 0.5
    let sum = 0
    for (let k = 0; k < FFT_SIZE; k++) sum += data[k]
    frames.push({
      audioData: data,
      energy: sum / FFT_SIZE,
      beat: false,
    })
  }
  return frames
}

export function beatPattern(frameCount: number = DEFAULT_FRAMES, bpm: number = 120): Frame[] {
  const period = Math.max(1, Math.round((60 / bpm) * 60))
  const frames: Frame[] = []
  for (let i = 0; i < frameCount; i++) {
    const isBeat = i > 0 && i % period === 0
    if (isBeat) {
      const data = new Float32Array(FFT_SIZE)
      for (let k = 0; k < 20; k++) data[k] = 0.8
      frames.push({
        audioData: data,
        energy: 0.12,
        beat: true,
      })
    } else {
      frames.push({
        audioData: new Float32Array(FFT_SIZE),
        energy: 0.02,
        beat: false,
      })
    }
  }
  return frames
}

export function rampPattern(frameCount: number = DEFAULT_FRAMES): Frame[] {
  const frames: Frame[] = []
  const denom = Math.max(1, frameCount - 1)
  for (let i = 0; i < frameCount; i++) {
    const t = i / denom
    const energy = t * 0.12
    const amp = t * 0.5
    const data = new Float32Array(FFT_SIZE)
    for (let k = 0; k < FFT_SIZE; k++) {
      data[k] = amp * (0.3 + 0.7 * Math.sin(k * 0.05 + i * 0.1))
    }
    frames.push({
      audioData: data,
      energy,
      beat: false,
    })
  }
  return frames
}
