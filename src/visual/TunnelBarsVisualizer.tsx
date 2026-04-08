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
      }

      if (coverImgRef.current) {
        const img = coverImgRef.current
        const scale = Math.max(W / img.width, H / img.height)
        const iw = img.width * scale
        const ih = img.height * scale
        ctx.filter = 'blur(20px) brightness(0.7)'
        ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih)
        ctx.filter = 'none'
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, H)
        grad.addColorStop(0, '#0a0a0a')
        grad.addColorStop(0.5, '#111')
        grad.addColorStop(1, '#0a0a0a')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, W, H)
      }

      const a10 = isPlaying && audioData.length > 10 ? audioData[10] : 0
      const a20 = isPlaying && audioData.length > 20 ? audioData[20] : 0

      const baseHeight = H * 0.15 * pp.barHeight

      if (beat && isPlaying) {
        beatFlashRef.current = 2
        beatExpandRef.current = H * 0.08
        shakeXRef.current = (Math.random() - 0.5) * 8
        shakeYRef.current = (Math.random() - 0.5) * 6
        chromaFramesRef.current = 3
      }
      if (beatFlashRef.current > 0) beatFlashRef.current--
      beatExpandRef.current *= 0.7

      shakeXRef.current *= 0.8
      shakeYRef.current *= 0.8
      const shakeX = shakeXRef.current
      const shakeY = shakeYRef.current

      if (chromaFramesRef.current > 0) chromaFramesRef.current--
      const chromaActive = chromaFramesRef.current > 0

      const beatExpand = beatExpandRef.current
      const flash = beatFlashRef.current > 0

      const targetTop = baseHeight + a10 * H * 0.2 + beatExpand
      const targetBottom = baseHeight + a20 * H * 0.2 + beatExpand

      if (isPlaying) {
        smoothTopRef.current = smoothTopRef.current * smooth + targetTop * (1 - smooth)
        smoothBottomRef.current = smoothBottomRef.current * smooth + targetBottom * (1 - smooth)
      } else {
        smoothTopRef.current = baseHeight + (smoothTopRef.current - baseHeight) * 0.95
        smoothBottomRef.current = baseHeight + (smoothBottomRef.current - baseHeight) * 0.95
      }

      const topH = smoothTopRef.current
      const bottomH = smoothBottomRef.current

      const tiltTop = (Math.sin(time * 0.05) * 25 + Math.sin(time * 0.13) * 10) * pp.tilt
      const tiltBottom = (Math.cos(time * 0.07) * 20 + Math.sin(time * 0.11) * 8) * pp.tilt

      const targetTopLeft = topH + tiltTop
      const targetTopRight = topH - tiltTop
      const targetBottomLeft = bottomH + tiltBottom
      const targetBottomRight = bottomH - tiltBottom

      if (isPlaying) {
        smoothTopLeftRef.current = smoothTopLeftRef.current * smooth + targetTopLeft * (1 - smooth)
        smoothTopRightRef.current = smoothTopRightRef.current * smooth + targetTopRight * (1 - smooth)
        smoothBottomLeftRef.current = smoothBottomLeftRef.current * smooth + targetBottomLeft * (1 - smooth)
        smoothBottomRightRef.current = smoothBottomRightRef.current * smooth + targetBottomRight * (1 - smooth)
      } else {
        const baseTL = baseHeight + tiltTop
        const baseTR = baseHeight - tiltTop
        const baseBL = baseHeight + tiltBottom
        const baseBR = baseHeight - tiltBottom
        smoothTopLeftRef.current = baseTL + (smoothTopLeftRef.current - baseTL) * 0.95
        smoothTopRightRef.current = baseTR + (smoothTopRightRef.current - baseTR) * 0.95
        smoothBottomLeftRef.current = baseBL + (smoothBottomLeftRef.current - baseBL) * 0.95
        smoothBottomRightRef.current = baseBR + (smoothBottomRightRef.current - baseBR) * 0.95
      }

      const tl = smoothTopLeftRef.current
      const tr = smoothTopRightRef.current
      const bl = smoothBottomLeftRef.current
      const br = smoothBottomRightRef.current

      ctx.save()
      ctx.translate(shakeX, shakeY)

      ctx.fillStyle = '#000000'
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(W, 0)
      ctx.lineTo(W, tr)
      ctx.lineTo(0, tl)
      ctx.closePath()
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(0, H)
      ctx.lineTo(W, H)
      ctx.lineTo(W, H - br)
      ctx.lineTo(0, H - bl)
      ctx.closePath()
      ctx.fill()

      tearFrameRef.current++
      if (tearFrameRef.current >= 3) {
        tearFrameRef.current = 0
        tearTopRef.current = generateTearPoints(TEAR_POINTS)
        tearBottomRef.current = generateTearPoints(TEAR_POINTS)
      }

      const xOffset = Math.sin(time * 0.1) * 0.3

      ctx.save()
}}}
)
