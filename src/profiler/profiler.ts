import { pixelDiff, brightnessMean, colorVariance, dominantMood, edgeDensity } from './canvasMetrics'
import {
  silencePattern,
  whiteNoisePattern,
  bassPattern,
  treblePattern,
  beatPattern,
  rampPattern,
  type Frame,
} from './testPatterns'
import { _internalState } from '../recorder/rafShim'

export type VibeProfile = {
  energy: number
  complexity: number
  motion: number
  mood: 'warm' | 'cold' | 'neon' | 'dark'
}

type Mood = VibeProfile['mood']

interface PassConfig {
  name: string
  canvasReadyTimeoutMs: number
  warmupFrames: number
  measureFrames: number
  // 'source' — родные размеры канваса с потолком
  sampleDim: number | 'source'
  pixelDiffThreshold: number
  edgeDensityThreshold: number
  reducedPatterns: boolean
}

const PASS_1: PassConfig = {
  name: 'pass 1',
  canvasReadyTimeoutMs: 1000,
  warmupFrames: 20,
  measureFrames: 60,
  sampleDim: 128,
  pixelDiffThreshold: 6,
  edgeDensityThreshold: 24,
  reducedPatterns: true,
}

const PASS_2: PassConfig = {
  name: 'pass 2',
  canvasReadyTimeoutMs: 5000,
  warmupFrames: 90,
  measureFrames: 180,
  sampleDim: 256,
  pixelDiffThreshold: 3,
  edgeDensityThreshold: 12,
  reducedPatterns: false,
}

const PASS_3: PassConfig = {
  name: 'pass 3',
  canvasReadyTimeoutMs: 8000,
  warmupFrames: 180,
  measureFrames: 180,
  sampleDim: 'source',
  pixelDiffThreshold: 1,
  edgeDensityThreshold: 4,
  reducedPatterns: false,
}

const PASSES: PassConfig[] = [PASS_1, PASS_2, PASS_3]

const FALLBACK_PROFILE: VibeProfile = {
  energy: 0.5,
  complexity: 0.5,
  motion: 0.5,
  mood: 'neon',
}

const QUEUE_READY_TIMEOUT_MS = 1000
const QUEUE_POLL_INTERVAL_MS = 20
const CANVAS_POLL_INTERVAL_MS = 30
const CANVAS_NON_BLACK_MIN = 10
const CANVAS_LUMA_THRESHOLD = 15
const SOURCE_SAMPLE_CAP = 1024
const DEGENERATE_THRESHOLD = 0.01

interface Sampler {
  width: number
  height: number
  capture(source: HTMLCanvasElement): ImageData | null
}

function makeSampler(w: number, h: number): Sampler {
  const c = document.createElement('canvas')
  c.width = Math.max(1, w)
  c.height = Math.max(1, h)
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('не удалось получить 2d контекст для sampler')
  return {
    width: c.width,
    height: c.height,
    capture(source: HTMLCanvasElement): ImageData | null {
      if (source.width === 0 || source.height === 0) return null
      ctx.clearRect(0, 0, c.width, c.height)
      try {
        ctx.drawImage(source, 0, 0, c.width, c.height)
      } catch {
        return null
      }
      return ctx.getImageData(0, 0, c.width, c.height)
    },
  }
}

function resolveSampleDims(canvas: HTMLCanvasElement, dim: number | 'source'): { w: number; h: number } {
  if (dim === 'source') {
    return {
      w: Math.min(SOURCE_SAMPLE_CAP, Math.max(1, canvas.width)),
      h: Math.min(SOURCE_SAMPLE_CAP, Math.max(1, canvas.height)),
    }
  }
  return { w: dim, h: dim }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

async function waitForShimQueue(timeoutMs: number): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (_internalState().queueSize > 0) return true
    await new Promise<void>((r) => setTimeout(r, QUEUE_POLL_INTERVAL_MS))
  }
  return false
}

async function waitForCanvasReady(
  canvas: HTMLCanvasElement,
  onFrameDrive: (f: Frame) => Promise<void>,
  maxWaitMs: number,
): Promise<boolean> {
  const probe = document.createElement('canvas')
  probe.width = 64
  probe.height = 64
  const pctx = probe.getContext('2d', { willReadFrequently: true })
  if (!pctx) return false

  const silent: Frame = { audioData: new Float32Array(1024), energy: 0, beat: false }
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    await onFrameDrive(silent)
    await onFrameDrive(silent)

    if (canvas.width > 0 && canvas.height > 0) {
      try {
        pctx.clearRect(0, 0, 64, 64)
        pctx.drawImage(canvas, 0, 0, 64, 64)
        const data = pctx.getImageData(0, 0, 64, 64).data
        let nonBlack = 0
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] + data[i + 1] + data[i + 2] > CANVAS_LUMA_THRESHOLD) {
            nonBlack++
            if (nonBlack > CANVAS_NON_BLACK_MIN) return true
          }
        }
      } catch {
      }
    }

    await new Promise<void>((r) => setTimeout(r, CANVAS_POLL_INTERVAL_MS))
  }
  return false
}

async function runWarmup(onFrameDrive: (f: Frame) => Promise<void>, frameCount: number): Promise<void> {
  const frames = silencePattern(frameCount)
  for (let i = 0; i < frames.length; i++) {
    await onFrameDrive(frames[i])
  }
}

interface PatternStats {
  avgPixelDiff: number
  avgBrightness: number
  brightnessStart: number
  brightnessEnd: number
  peakPixelDiffOnBeat: number
  avgEdgeDensity: number
  avgVarianceMag: number
}

function buildPatterns(measureFrames: number) {
  return {
    silence: silencePattern(measureFrames),
    noise: whiteNoisePattern(measureFrames),
    bass: bassPattern(measureFrames),
    treble: treblePattern(measureFrames),
    beat: beatPattern(measureFrames, 120),
    ramp: rampPattern(measureFrames),
  }
}

function isDegenerate(p: VibeProfile): boolean {
  return p.energy < DEGENERATE_THRESHOLD
    && p.complexity < DEGENERATE_THRESHOLD
    && p.motion < DEGENERATE_THRESHOLD
}

async function runSinglePass(
  pass: PassConfig,
  canvas: HTMLCanvasElement,
  onFrameDrive: (frame: Frame) => Promise<void>,
): Promise<{ profile: VibeProfile; timings: Record<string, number>; sampleW: number; sampleH: number }> {
  const dims = resolveSampleDims(canvas, pass.sampleDim)
  const sampler = makeSampler(dims.w, dims.h)
  const moodVotes: Record<Mood, number> = { warm: 0, cold: 0, neon: 0, dark: 0 }

  async function runPattern(frames: Frame[]): Promise<PatternStats> {
    // разминка перед замером стабилизирует внутреннее состояние
    await runWarmup(onFrameDrive, pass.warmupFrames)

    let prev: ImageData | null = null
    let diffSum = 0
    let diffCount = 0
    let brightSum = 0
    let brightFirst = 0
    let brightLast = 0
    let peakBeatDiff = 0
    let edgeSum = 0
    let varSum = 0
    let captured = 0

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i]
      await onFrameDrive(frame)
      const img = sampler.capture(canvas)
      if (!img) continue
      const diff = pixelDiff(prev, img, pass.pixelDiffThreshold)
      const br = brightnessMean(img)
      const ed = edgeDensity(img, pass.edgeDensityThreshold)
      const cv = colorVariance(img)
      const mag = Math.sqrt(cv.r * cv.r + cv.g * cv.g + cv.b * cv.b)
      const mood = dominantMood(img)

      if (prev) {
        diffSum += diff
        diffCount++
      }
      brightSum += br
      if (captured === 0) brightFirst = br
      brightLast = br
      edgeSum += ed
      varSum += mag
      moodVotes[mood]++
      captured++

      if (frame.beat && diff > peakBeatDiff) peakBeatDiff = diff

      prev = img
    }
}}
