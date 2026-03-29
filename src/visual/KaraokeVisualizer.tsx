import { useCallback, useEffect, useRef, useState } from 'react'
import { audioEngine } from '../audio/audioEngine'
import { useAudioStore } from '../store/audioStore'
import type { LrcLine } from '../utils/lrcParser'

const IDLE_MS = 2000

function findActiveIndex(lines: LrcLine[], t: number): number {
  if (lines.length === 0) return -1
  let lo = 0
  let hi = lines.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].time <= t) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return ans
}

export function KaraokeVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lrcLines = useAudioStore((s) => s.lrcLines)
  const currentTime = useAudioStore((s) => s.currentTime)
  const beat = useAudioStore((s) => s.beat)
  const isPlayingStore = useAudioStore((s) => s.isPlaying)

  const lineRefs = useRef<(HTMLDivElement | null)[]>([])
  const ignoreProgrammaticScroll = useRef(false)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [manualScroll, setManualScroll] = useState(false)

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }, [])

  const scheduleSnapBack = useCallback(() => {
    clearIdleTimer()
    idleTimerRef.current = window.setTimeout(() => {
      idleTimerRef.current = null
      setManualScroll(false)
    }, IDLE_MS)
  }, [clearIdleTimer])

  const lastLineClickRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isPlayingStore) lastLineClickRef.current = null
  }, [isPlayingStore])

  const onLineActivate = useCallback(
    (lineTime: number) => {
      const playing = useAudioStore.getState().isPlaying
      if (lastLineClickRef.current === lineTime && playing) {
        audioEngine.pause()
        lastLineClickRef.current = null
        return
      }

      lastLineClickRef.current = lineTime
      clearIdleTimer()
      setManualScroll(false)
      audioEngine.seek(lineTime)
      if (!useAudioStore.getState().isPlaying) {
        audioEngine.play()
      }
    },
    [clearIdleTimer],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const { energy, beat: b } = useAudioStore.getState()
      const w = canvas.width
      const h = canvas.height
      const pulse = b ? 0.18 : 0
      const e = Math.min(1, energy)
      const base = 0.12 + e * 0.42 + pulse
      const g = ctx.createRadialGradient(
        w * 0.5,
        h * 0.34,
        0,
        w * 0.5,
        h * 0.34,
        Math.max(w, h) * 0.58,
      )
      g.addColorStop(0, `rgba(130, 70, 210, ${0.28 + base * 0.55})`)
      g.addColorStop(0.42, `rgba(40, 120, 200, ${0.12 + base * 0.2})`)
      g.addColorStop(0.72, `rgba(14, 10, 28, ${0.9 + base * 0.06})`)
      g.addColorStop(1, '#030206')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  useEffect(() => () => clearIdleTimer(), [clearIdleTimer])

  const idx = findActiveIndex(lrcLines, currentTime)

  useEffect(() => {
    setManualScroll(false)
    clearIdleTimer()
  }, [lrcLines, clearIdleTimer])

  useEffect(() => {
    if (manualScroll || lrcLines.length === 0 || idx < 0) return
    const el = lineRefs.current[idx]
    if (!el) return
    ignoreProgrammaticScroll.current = true
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const t = window.setTimeout(() => {
      ignoreProgrammaticScroll.current = false
    }, 450)
    return () => clearTimeout(t)
  }, [idx, manualScroll, lrcLines.length])

  const onScrollContainer = useCallback(() => {
    if (ignoreProgrammaticScroll.current) return
    setManualScroll(true)
    scheduleSnapBack()
  }, [scheduleSnapBack])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          padding: 'min(5vh, 40px) min(6vw, 32px) 0',
          boxSizing: 'border-box',
        }}
      >
        {lrcLines.length === 0 ? (
          <p
            style={{
              flex: 1,
}}}}
))
