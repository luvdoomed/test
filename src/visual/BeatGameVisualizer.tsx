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

  const onArenaClick = useCallback(() => {
    if (duration <= 0 || beatTimes.length === 0) return

    let best = -1
    let bestD = Infinity
    beatTimes.forEach((bt, i) => {
      if (resolvedRef.current.has(i)) return
      const d = Math.abs(currentTime - bt)
      if (d < HIT_WINDOW_SEC && d < bestD) {
        bestD = d
        best = i
      }
    })

    if (best >= 0) {
      resolvedRef.current.add(best)
      setStats((s) => {
        const combo = s.combo + 1
        return {
          hits: s.hits + 1,
          misses: s.misses,
          combo,
          maxCombo: Math.max(s.maxCombo, combo),
        }
      })
      setFlash('hit')
      window.setTimeout(() => setFlash(null), 140)
    }
  }, [beatTimes, currentTime, duration])

  const interval = 60 / DEFAULT_BPM
  let nextIdx = beatTimes.findIndex((t) => t > currentTime)
  if (nextIdx === -1) nextIdx = beatTimes.length
  const prevT = nextIdx === 0 ? 0 : beatTimes[nextIdx - 1]!
  const nextT = nextIdx < beatTimes.length ? beatTimes[nextIdx]! : duration
  const phase =
    nextT > prevT ? Math.min(1, Math.max(0, (currentTime - prevT) / (nextT - prevT))) : 0

  const totalResolved = stats.hits + stats.misses
  const pending = beatTimes.length - totalResolved

  return (
    <div className="beat-game">
      <div className="beat-game__hud">
        <span>Попадания: {stats.hits}</span>
        <span>Промахи: {stats.misses}</span>
        <span>Комбо: {stats.combo}</span>
        <span>Рекорд: {stats.maxCombo}</span>
        <span className="beat-game__hint">BPM ~{DEFAULT_BPM} · окно ±{(HIT_WINDOW_SEC * 1000) | 0} мс</span>
      </div>

      {duration <= 0 ? (
        <div className="beat-game__empty">Загрузите трек, затем нажмите Play</div>
      ) : (
        <>
          <button
            type="button"
            className={`beat-game__arena${flash === 'hit' ? ' beat-game__arena--hit' : ''}${flash === 'miss' ? ' beat-game__arena--miss' : ''}`}
            onClick={onArenaClick}
            aria-label="Клик в такт"
          >
}}
))
