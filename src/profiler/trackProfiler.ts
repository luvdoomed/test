import { analyzeOffline } from '../audio/offlineAnalyzer'
import type { VibeProfile } from './profiler'

const TRACK_FPS = 60
const BASS_HI = 20
const TREBLE_LO = 80
const TREBLE_HI = 200
const BPM_THRESHOLD_MULT = 1.2
const MAX_EXPECTED_BPM = 200
const MOTION_BPM_FULL = 140
const TRANSIENT_JUMP = 1.3

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function estimateBpm(envelope: Float32Array, fps: number): number {
  const n = envelope.length
  if (n < fps * 2) return 0

  let sum = 0
  for (let i = 0; i < n; i++) sum += envelope[i]
  const mean = sum / n
  const threshold = mean * BPM_THRESHOLD_MULT

  const minDist = Math.max(1, Math.round((fps * 60) / MAX_EXPECTED_BPM))
  const peaks: number[] = []
  for (let i = 1; i < n - 1; i++) {
    const v = envelope[i]
    if (v > threshold && v > envelope[i - 1] && v >= envelope[i + 1]) {
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDist) {
        peaks.push(i)
      }
    }
  }

  if (peaks.length < 2) return 0

  const gaps: number[] = []
  for (let i = 1; i < peaks.length; i++) gaps.push(peaks[i] - peaks[i - 1])
  gaps.sort((a, b) => a - b)
  const medianGap = gaps[Math.floor(gaps.length / 2)]
  if (medianGap <= 0) return 0
  return (60 * fps) / medianGap
}

export async function profileTrack(audioBuffer: AudioBuffer): Promise<VibeProfile> {
  console.log('[automode] profileTrack вход: duration=', audioBuffer.duration.toFixed(2), 'сек, sampleRate=', audioBuffer.sampleRate, 'каналов=', audioBuffer.numberOfChannels)
  const analysis = await analyzeOffline(audioBuffer, TRACK_FPS)
  const { snapshots, energies } = analysis
  const framesN = snapshots.length

  if (framesN === 0 || snapshots[0].length === 0) {
    console.warn('[automode] profileTrack: нет кадров в анализе, возвращаю fallback')
    return { energy: 0.5, complexity: 0.5, motion: 0.5, mood: 'dark' }
  }

  const bins = snapshots[0].length
  const bassBinCount = Math.min(BASS_HI, bins)
  const trebleLo = Math.min(TREBLE_LO, bins)
  const trebleHi = Math.min(TREBLE_HI, bins)
  const trebleBinCount = Math.max(1, trebleHi - trebleLo)

  let bassSum = 0
  let trebleSum = 0
  let fluxSum = 0
  let centroidSum = 0
  const bassEnv = new Float32Array(framesN)
  let energyMin = Infinity
  let energyMax = -Infinity
  let transientFrames = 0

  for (let f = 0; f < framesN; f++) {
    const snap = snapshots[f]
    let bass = 0
    let treble = 0
}}
