import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { audioEngine } from '../audio/audioEngine'
import { useAudioStore } from '../store/audioStore'

const DEFAULT_BPM = 120
const HIT_WINDOW_SEC = 0.14
const FIRST_BEAT_DELAY_SEC = 1

function buildBeatTimes(durationSec: number, bpm: number): number[] {
  if (durationSec <= 0 || bpm <= 0) return []
  const interval = 60 / bpm
  const out: number[] = []
  let t = FIRST_BEAT_DELAY_SEC
  while (t < durationSec - 0.05) {
    out.push(t)
    t += interval
  }
  return out
}

export function BeatGameVisualizer() {
  const currentTime = useAudioStore((s) => s.currentTime)
  const isPlaying = useAudioStore((s) => s.isPlaying)
  const title = useAudioStore((s) => s.trackInfo.title)

  const duration = audioEngine.getDuration() ?? 0
  const beatTimes = useMemo(() => buildBeatTimes(duration, DEFAULT_BPM), [duration])

  const resolvedRef = useRef<Set<number>>(new Set())
  const [stats, setStats] = useState({ hits: 0, misses: 0, combo: 0, maxCombo: 0 })
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null)
  const [showEnd, setShowEnd] = useState(false)

  useEffect(() => {
    resolvedRef.current = new Set()
    setStats({ hits: 0, misses: 0, combo: 0, maxCombo: 0 })
    setShowEnd(false)
  }, [duration, title])

  useEffect(() => {
    if (duration <= 0 || showEnd) return
    if (currentTime >= duration - 0.08) {
      setShowEnd(true)
    }
  }, [currentTime, duration, showEnd])

  useEffect(() => {
    if (duration <= 0 || beatTimes.length === 0) return
    const missed: number[] = []
    beatTimes.forEach((bt, i) => {
      if (resolvedRef.current.has(i)) return
      if (currentTime > bt + HIT_WINDOW_SEC) missed.push(i)
    })
    if (missed.length === 0) return
    missed.forEach((i) => resolvedRef.current.add(i))
    setStats((s) => ({
      ...s,
      misses: s.misses + missed.length,
      combo: 0,
    }))
  }, [currentTime, beatTimes, duration])
}
