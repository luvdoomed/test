import type { VibeProfile } from './profiler'

const KEY = 'viz-profiles-v1'

function readAll(): Record<string, VibeProfile> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, VibeProfile> | null
    return parsed ?? {}
  } catch {
    return {}
  }
}

function writeAll(data: Record<string, VibeProfile>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
  }
}

export function getCachedProfile(id: string): VibeProfile | null {
  const all = readAll()
  return all[id] ?? null
}

export function setCachedProfile(id: string, p: VibeProfile): void {
  const all = readAll()
  all[id] = p
  writeAll(all)
}

export function clearProfileCache(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* игнорим */
  }
}

export function getAllCachedProfiles(): Record<string, VibeProfile> {
  return readAll()
}
