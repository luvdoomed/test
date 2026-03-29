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
}}
)
