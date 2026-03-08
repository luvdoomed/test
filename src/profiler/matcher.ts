import type { VibeProfile } from './profiler'

const MOOD_MISMATCH_PENALTY = 0.5
const RECENT_LIMIT = 2
const WEIGHTS = [0.4, 0.25, 0.15, 0.12, 0.08]

let recentIds: string[] = []

export function matchVisualizers(
  track: VibeProfile,
  visualizers: Record<string, VibeProfile>,
  topN: number = 5,
): Array<{ id: string; distance: number }> {
  const results: Array<{ id: string; distance: number }> = []
  for (const id in visualizers) {
    const v = visualizers[id]
    const de = track.energy - v.energy
    const dc = track.complexity - v.complexity
    const dm = track.motion - v.motion
    const moodPenalty = track.mood === v.mood ? 0 : MOOD_MISMATCH_PENALTY
    const distance = Math.sqrt(de * de + dc * dc + dm * dm + moodPenalty * moodPenalty)
    results.push({ id, distance })
  }
  results.sort((a, b) => a.distance - b.distance)
  return results.slice(0, topN)
}

// взвешенный случайный выбор из топа, исключая последние выбранные
export function selectWeightedFromTop(
  matches: Array<{ id: string; distance: number }>,
): { chosenId: string | null; excluded: string[] } {
  const excluded = recentIds.slice()
  if (matches.length === 0) return { chosenId: null, excluded }

  const filtered = matches.filter((m) => !excluded.includes(m.id))
  const pool = filtered.length > 0 ? filtered : matches

  const weights = WEIGHTS.slice(0, pool.length)
  const wSum = weights.reduce((s, w) => s + w, 0)
  const r = Math.random() * wSum
  let acc = 0
  let idx = pool.length - 1
  for (let i = 0; i < pool.length; i++) {
    acc += weights[i]
    if (r <= acc) {
      idx = i
      break
    }
  }
  const chosenId = pool[idx].id

  recentIds.push(chosenId)
  if (recentIds.length > RECENT_LIMIT) recentIds.shift()

  return { chosenId, excluded }
}

export function resetRecentVisualizers(): void {
  recentIds = []
}
