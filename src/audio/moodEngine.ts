import type { TrackFeatures } from './meydaAnalyzer'
import type { LibraryTrack } from '../store/libraryStore'

export type MoodId = 'energetic' | 'upbeat' | 'calm' | 'sad' | 'melancholic'

export type MoodWeights = Record<MoodId, number>

export const MOOD_ORDER: MoodId[] = ['energetic', 'upbeat', 'calm', 'sad', 'melancholic']

export const MOOD_LABELS: Record<MoodId, string> = {
  energetic: 'Энергично',
  upbeat: 'Бодро',
  calm: 'Спокойно',
  sad: 'Грустно',
  melancholic: 'Меланхолично',
}

export const MOOD_GRADIENTS: Record<MoodId, string> = {
  energetic:   'linear-gradient(135deg, #ff6b35, #f7931e)',
  upbeat:      'linear-gradient(135deg, #ff5e8a, #ff8c42)',
  calm:        'linear-gradient(135deg, #6dd5ed, #a8e6cf)',
  sad:         'linear-gradient(135deg, #364f6b, #5d7b9e)',
  melancholic: 'linear-gradient(135deg, #6a4c93, #8e7cc3)',
}

// плавный переход 0..1 при пересечении порога t с шириной w
const smoothAbove = (v: number, t: number, w: number): number => {
  if (v <= t - w) return 0
  if (v >= t + w) return 1
  return (v - (t - w)) / (w * 2)
}
const smoothBelow = (v: number, t: number, w: number): number =>
  1 - smoothAbove(v, t, w)

const weighted = (parts: Array<{ score: number; weight: number }>): number => {
  const sum = parts.reduce((s, p) => s + p.weight, 0)
  if (sum === 0) return 0
  const acc = parts.reduce((s, p) => s + p.score * p.weight, 0)
  return Math.max(0, Math.min(1, acc / sum))
}

export function computeMoodWeights(f: TrackFeatures): MoodWeights {
  const energetic = weighted([
    { score: smoothAbove(f.rmsMean, 0.15, 0.05),       weight: 1.0 },
    { score: smoothAbove(f.centroidMean, 3500, 800),   weight: 1.0 },
    { score: smoothAbove(f.flatnessMean, 0.10, 0.05),  weight: 0.8 },
    { score: smoothAbove(f.zcrMean, 0.07, 0.03),       weight: 0.8 },
  ])

  const upbeat = weighted([
    { score: smoothAbove(f.rmsMean, 0.13, 0.04), weight: 1.0 },
    {
      score: smoothAbove(f.centroidMean, 2200, 500) * smoothBelow(f.centroidMean, 3700, 500),
      weight: 1.0,
    },
    { score: smoothAbove(f.flatnessMean, 0.04, 0.02), weight: 0.6 },
    // верхняя граница: не слишком шумно
    { score: smoothBelow(f.flatnessMean, 0.20, 0.05), weight: 0.4 },
  ])

  const calm = weighted([
    { score: smoothBelow(f.rmsMean, 0.12, 0.04),      weight: 1.0 },
    { score: smoothBelow(f.flatnessMean, 0.10, 0.04), weight: 0.8 },
    { score: smoothBelow(f.zcrMean, 0.07, 0.03),      weight: 0.8 },
  ])

  const sad = weighted([
    { score: smoothBelow(f.rmsMean, 0.13, 0.04),      weight: 0.6 },
    { score: smoothBelow(f.centroidMean, 2200, 400),  weight: 1.0 },
    { score: smoothBelow(f.flatnessMean, 0.06, 0.02), weight: 0.9 },
    { score: smoothBelow(f.zcrMean, 0.05, 0.02),      weight: 0.5 },
  ])

  const melancholic = weighted([
    { score: smoothBelow(f.centroidMean, 2300, 500),  weight: 0.9 },
    { score: smoothBelow(f.flatnessMean, 0.06, 0.02), weight: 0.7 },
    { score: smoothBelow(f.zcrMean, 0.07, 0.03),      weight: 0.5 },
    // присутствует, не полная тишина
    { score: smoothAbove(f.rmsMean, 0.08, 0.04),      weight: 0.4 },
  ])

  return { energetic, upbeat, calm, sad, melancholic }
}

export function getTracksByMood(
  tracks: LibraryTrack[],
  mood: MoodId,
  threshold = 0.5,
): LibraryTrack[] {
  const scored = tracks
    .filter((t) => t.features)
    .map((t) => ({ track: t, weight: computeMoodWeights(t.features!)[mood] }))
    .filter((x) => x.weight >= threshold)
    .sort((a, b) => b.weight - a.weight)
  return scored.map((x) => x.track)
}

const RECENT_PICK_MEMORY = 3
const recentPicks: string[] = []
let lastPickedForTrack: string | null = null

export interface PickVizOptions {
  force?: boolean
}

export function pickVizForMood(
  mood: MoodId,
  trackId: string,
  viz: Array<{ id: string; moods: MoodId[] }>,
  opts: PickVizOptions = {},
): string | null {
  if (!opts.force && trackId === lastPickedForTrack) return null
  lastPickedForTrack = trackId

  const candidates = viz.filter((v) => v.moods.includes(mood))
  if (candidates.length === 0) return null

  let pool = candidates.filter((c) => !recentPicks.includes(c.id))
  if (pool.length === 0) {
    const last = recentPicks[recentPicks.length - 1] ?? null
    pool = candidates.filter((c) => c.id !== last)
  }
  if (pool.length === 0) pool = candidates

  const avoided = [...recentPicks]
  const chosen = pool[Math.floor(Math.random() * pool.length)].id

  recentPicks.push(chosen)
  if (recentPicks.length > RECENT_PICK_MEMORY) recentPicks.shift()

  console.log('[viz-pick]', mood, '→', chosen, 'candidates:', candidates.length, 'avoided:', avoided)
  return chosen
}

export function getLastAutoPickedViz(): string | null {
  return recentPicks.length > 0 ? recentPicks[recentPicks.length - 1] : null
}

export function resetMoodPicker(): void {
  recentPicks.length = 0
  lastPickedForTrack = null
}
