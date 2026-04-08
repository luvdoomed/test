import { useEffect, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'
import { audioEngine } from '../audio/audioEngine'
import { useVisualizerParams } from '../presets/useVisualizerParams'

interface TunnelBarsParams {
  barHeight: number
  ringSize: number
  rotationSpeed: number
  smoothing: number
  tilt: number
}

interface EdgeParticle {
  pos: number
  speed: number
  size: number
  opacity: number
}

function createEdgeParticles(count: number): EdgeParticle[] {
  return Array.from({ length: count }, () => ({
    pos: Math.random(),
    speed: (Math.random() * 0.0004 + 0.0002) * (Math.random() > 0.5 ? 1 : -1),
    size: Math.random() * 2 + 2,
    opacity: Math.random() * 0.6 + 0.4,
  }))
}

function generateTearPoints(count: number): number[] {
  return Array.from({ length: count }, () => (Math.random() - 0.5) * 16)
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const TEAR_POINTS = 120
const PARTICLE_COUNT = 20
const CIRCLE_BARS = 64
const BASE_RADIUS = 80

export function TunnelBarsVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)

  const smoothTopRef = useRef(0)
  const smoothBottomRef = useRef(0)
  const smoothTopLeftRef = useRef(0)
  const smoothTopRightRef = useRef(0)
  const smoothBottomLeftRef = useRef(0)
  const smoothBottomRightRef = useRef(0)

  const beatFlashRef = useRef(0)
  const beatExpandRef = useRef(0)

  const tearTopRef = useRef(generateTearPoints(TEAR_POINTS))
  const tearBottomRef = useRef(generateTearPoints(TEAR_POINTS))
  const tearFrameRef = useRef(0)

  const topParticlesRef = useRef(createEdgeParticles(PARTICLE_COUNT))
  const bottomParticlesRef = useRef(createEdgeParticles(PARTICLE_COUNT))

  const shakeXRef = useRef(0)
  const shakeYRef = useRef(0)

  const chromaFramesRef = useRef(0)

  const timeRef = useRef(0)

  const rotationRef = useRef(0)
  const radiusPulseRef = useRef(BASE_RADIUS)
  const smoothedCircleRef = useRef(new Float32Array(CIRCLE_BARS))

  const coverImgRef = useRef<HTMLImageElement | null>(null)
  const coverUrlRef = useRef('')

  const params = useVisualizerParams<TunnelBarsParams>('tunnelbars')
  const paramsRef = useRef(params)
  paramsRef.current = params

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    function draw() {
      if (!canvas || !ctx) return

      const { audioData, beat, isPlaying, trackInfo, currentTime } = useAudioStore.getState()
      const pp = paramsRef.current
      const smooth = pp.smoothing
      const W = canvas.width
      const H = canvas.height

      timeRef.current++
      const time = timeRef.current

      const coverUrl = trackInfo.cover
      if (coverUrl && coverUrl !== coverUrlRef.current) {
        coverUrlRef.current = coverUrl
        const img = new Image()
        img.src = coverUrl
        img.onload = () => { coverImgRef.current = img }
      } else if (!coverUrl) {
        coverImgRef.current = null
        coverUrlRef.current = ''
}}}}
)
