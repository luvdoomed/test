import { useEffect, useRef, useState } from 'react'
import { useAudioStore } from '../store/audioStore'
import { useVisualizerParams } from '../presets/useVisualizerParams'

interface CardParams {
  barCount: number
  smoothing: number
  beatScale: number
  chromaShift: number
  glow: number
}

const MAX_BAR_COUNT = 128
const PARTICLE_COUNT = 38
const GEO_PARTICLE_COUNT = 15
const KALEIDOSCOPE_SEGMENTS = 8

const CARD_W_BASE = 700
const CARD_H_BASE = 160

type Vec2 = { x: number; y: number }
type GeoShape = 'cross' | 'circle' | 'diamond' | 'square'

interface GeoParticle {
  shape: GeoShape
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rotation: number
  rotationSpeed: number
  baseX: number
  baseY: number
  burstFrames: number
}

function makeGeoParticle(sw: number, sh: number, scl: number): GeoParticle {
  const shapes: GeoShape[] = ['cross', 'circle', 'diamond', 'square']
  const x = Math.random() * sw
  const y = Math.random() * sh
  return {
    shape: shapes[Math.floor(Math.random() * shapes.length)]!,
    x, y,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    size: (15 + Math.random() * 20) * devicePixelRatio * scl,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (0.005 + Math.random() * 0.015) * (Math.random() < 0.5 ? 1 : -1),
    baseX: x,
    baseY: y,
    burstFrames: 0,
  }
}

function drawGeoShape(ctx: CanvasRenderingContext2D, p: GeoParticle, scl: number) {
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.rotation)
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = 1.5 * devicePixelRatio * scl
  ctx.beginPath()
  const s = p.size / 2
  switch (p.shape) {
    case 'cross':
      ctx.moveTo(-s, 0); ctx.lineTo(s, 0)
      ctx.moveTo(0, -s); ctx.lineTo(0, s)
      break
    case 'circle':
      ctx.arc(0, 0, s, 0, Math.PI * 2)
      break
    case 'diamond':
      ctx.moveTo(0, -s); ctx.lineTo(s, 0)
      ctx.lineTo(0, s); ctx.lineTo(-s, 0)
      ctx.closePath()
      break
    case 'square':
      ctx.rect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4)
      break
  }
  ctx.stroke()
  ctx.restore()
}

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

interface RGBA { r: number; g: number; b: number; a: number }

const COLOR_LOW: RGBA = { r: 150, g: 150, b: 255, a: 0.7 }
const COLOR_MID: RGBA = { r: 255, g: 255, b: 255, a: 0.9 }
const COLOR_HIGH: RGBA = { r: 255, g: 220, b: 100, a: 0.95 }

const GLOW_LOW: RGBA = { r: 100, g: 100, b: 255, a: 1 }
const GLOW_MID: RGBA = { r: 255, g: 255, b: 255, a: 1 }
const GLOW_HIGH: RGBA = { r: 255, g: 180, b: 50, a: 1 }

function lerpRGBA(from: RGBA, to: RGBA, t: number): RGBA {
  return {
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
    a: from.a + (to.a - from.a) * t,
  }
}

function targetColorByEnergy(energy: number, low: RGBA, mid: RGBA, high: RGBA): RGBA {
  if (energy <= 0.03) return low
  if (energy <= 0.055) {
    const t = (energy - 0.03) / 0.025
    return lerpRGBA(low, mid, t)
  }
  if (energy <= 0.08) {
    const t = (energy - 0.055) / 0.025
    return lerpRGBA(mid, high, t)
  }
  return high
}

function rgbaStr(c: RGBA): string {
  return `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${c.a.toFixed(3)})`
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const TRAIL_LEN_ALL = 3
const TRAIL_LEN_D = 5

type ParticleType = 'A' | 'B' | 'C' | 'D'

interface Particle {
  type: ParticleType
  x: number
  y: number
  vx: number
  vy: number
  opacity: number
  size: number
  angle: number
  angleSpeed: number
  orbitRadius: number
  orbitBaseRadius: number
  orbitCx: number
  orbitCy: number
  orbitBurstFrames: number
  trail: Vec2[]
  homeX: number
  homeY: number
  shooting: boolean
}

function makeParticle(sw: number, sh: number, cardW: number, cardH: number, scl: number): Particle {
  const rand = Math.random()
  const type: ParticleType = rand < 0.32 ? 'A' : rand < 0.6 ? 'B' : rand < 0.8 ? 'C' : 'D'

  const cardCx = sw / 2
  const cardCy = sh / 2
  const halfW = (cardW / 2) * devicePixelRatio
  const halfH = (cardH / 2) * devicePixelRatio

  const corners: Vec2[] = [
    { x: cardCx - halfW, y: cardCy - halfH },
    { x: cardCx + halfW, y: cardCy - halfH },
    { x: cardCx - halfW, y: cardCy + halfH },
    { x: cardCx + halfW, y: cardCy + halfH },
  ]
  const cornerIdx = Math.floor(Math.random() * corners.length)
  const corner = corners[cornerIdx]!

  const baseRadius = (30 + Math.random() * 60) * scl
  const angle = Math.random() * Math.PI * 2

  const startX = type === 'A'
    ? corner.x + Math.cos(angle) * baseRadius
    : type === 'D'
      ? corner.x
      : cardCx + (Math.random() - 0.5) * (cardW + 100) * devicePixelRatio
  const startY = type === 'C'
    ? cardCy + halfH + Math.random() * 40 * scl
    : type === 'D'
      ? corner.y
      : cardCy + (Math.random() - 0.5) * (cardH + 100) * devicePixelRatio

  return {
    type,
    x: startX,
    y: startY,
    vx: (Math.random() - 0.5) * 0.4,
    vy: type === 'C' ? -(0.3 + Math.random() * 0.3) * devicePixelRatio : (Math.random() - 0.5) * 0.4,
    opacity: 0.1 + Math.random() * 0.3,
    size: (1 + Math.random() * 2) * devicePixelRatio * scl,
    angle,
    angleSpeed: (0.01 + Math.random() * 0.02) * (Math.random() < 0.5 ? 1 : -1),
    orbitRadius: baseRadius,
    orbitBaseRadius: baseRadius,
    orbitCx: corner.x,
    orbitCy: corner.y,
    orbitBurstFrames: 0,
    trail: [],
    homeX: corner.x,
    homeY: corner.y,
    shooting: false,
  }
}

export function CardVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const smoothRef = useRef<Float32Array>(new Float32Array(MAX_BAR_COUNT))
  const prevEnergyRef = useRef(0)
  const particlesRef = useRef<Particle[]>([])
  const bloomIntensityRef = useRef(0)
  const cardGlowRef = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const globalBlurRef = useRef(4)
  const coverRef = useRef<HTMLImageElement>(null)
  const coverRotRef = useRef(0)
  const hueRef = useRef(0)
  const prevTrackRef = useRef('')
  const kaleidoRef = useRef<HTMLCanvasElement>(null)
  const kaleidoHueRef = useRef(0)
  const geoParticlesRef = useRef<GeoParticle[]>([])
  const cardBeatScaleRef = useRef(1.0)
  const cardBorderAlphaRef = useRef(0.08)
  const bgRedRef = useRef(5)
  const bgGreenRef = useRef(5)
  const bgBlueRef = useRef(16)

  const barColorRef = useRef<RGBA>({ ...COLOR_MID })
  const glowColorRef = useRef<RGBA>({ ...GLOW_MID })
  const hasCoverRef = useRef(false)

  const params = useVisualizerParams<CardParams>('card')
  const paramsRef = useRef(params)
  paramsRef.current = params

  const [dims, setDims] = useState(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
  }))

  useEffect(() => {
    const onResize = () => setDims({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const W = dims.w
  const H = dims.h
  const minDim = Math.min(W, H)
  const scl = minDim / 1080
  const shakeScl = minDim / 900
  const isVertical = H > W * 1.2

  const cardW = isVertical
    ? Math.min(W * 0.85, 520)
    : Math.min(CARD_W_BASE * Math.max(scl, 0.5), W * 0.9)
  const cardH = isVertical
    ? Math.min(H * 0.65, 560)
    : Math.min(CARD_H_BASE * Math.max(scl, 0.5), H * 0.3)
  const coverSize = isVertical
    ? Math.min(cardW * 0.65, cardH * 0.55)
    : Math.min(120 * Math.max(scl, 0.5), cardH - 40)
  const coverMargin = Math.round(20 * Math.max(scl, 0.5))
  const titleFontSize = Math.round(Math.max(14, 22 * Math.max(scl, 0.6)))
  const artistFontSize = Math.round(Math.max(10, 13 * Math.max(scl, 0.6)))
  const timeFontSize = Math.round(Math.max(10, 14 * Math.max(scl, 0.6)))
  const placeholderFontSize = Math.round(Math.max(24, 40 * Math.max(scl, 0.6)))
  const waveHeight = Math.round(Math.max(36, 60 * Math.max(scl, 0.6)))

  const cardDimsRef = useRef({ w: cardW, h: cardH, scl, shakeScl })
  cardDimsRef.current = { w: cardW, h: cardH, scl, shakeScl }

  const timeRef = useRef(0)
  const posXRef = useRef(W / 2)
  const posYRef = useRef(H / 2)
  const velXRef = useRef(0)
  const velYRef = useRef(0)
  const targetXRef = useRef(W / 2)
  const targetYRef = useRef(H / 2)

  const shakeXRef = useRef(0)
  const shakeYRef = useRef(0)
  const shakeVXRef = useRef(0)
  const shakeVYRef = useRef(0)
  const traumaRef = useRef(0)
  const kickXRef = useRef(0)
  const kickYRef = useRef(0)
  const jitterXRef = useRef(0)
  const jitterYRef = useRef(0)

  const cardOpacityRef = useRef(1.0)

  const beat = useAudioStore((s) => s.beat)

  useEffect(() => {
    if (!beat) return
    cardBeatScaleRef.current = 1.0 + 0.15 * paramsRef.current.beatScale
  }, [beat])

  useEffect(() => {
    const canvas = kaleidoRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let rafId = 0

    function resize() {
      if (!canvas) return
      canvas.width = canvas.offsetWidth * devicePixelRatio
      canvas.height = canvas.offsetHeight * devicePixelRatio
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    function drawKaleido() {
      if (!canvas || !ctx) return
      rafId = requestAnimationFrame(drawKaleido)

      const { energy, isPlaying } = useAudioStore.getState()
      const w = canvas.width
      const h = canvas.height
      const cx = w / 2
      const cy = h / 2
      const kScl = cardDimsRef.current.scl

      ctx.clearRect(0, 0, w, h)

      if (!isPlaying) return

      if (isPlaying) kaleidoHueRef.current += 0.2
      const hue = kaleidoHueRef.current % 360
      const time = performance.now() * 0.001
      const radius = Math.max(w, h) * 0.5

      ctx.save()
      ctx.translate(cx, cy)
      ctx.globalAlpha = 0.15 + energy * 0.3

      const segAngle = (Math.PI * 2) / KALEIDOSCOPE_SEGMENTS

      for (let seg = 0; seg < KALEIDOSCOPE_SEGMENTS; seg++) {
        ctx.save()
        ctx.rotate(seg * segAngle)

        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.arc(0, 0, radius, 0, segAngle)
        ctx.closePath()
        ctx.clip()

        for (let i = 0; i < 3; i++) {
          const phase = time * (0.3 + i * 0.15) + i * 2.1
          const amp = (80 + energy * 400) * kScl
          const cp1x = Math.sin(phase) * amp
          const cp1y = Math.cos(phase * 0.7 + i) * amp * 0.6
          const cp2x = Math.cos(phase * 1.3 + i * 0.5) * amp
          const cp2y = Math.sin(phase * 0.5 + i * 1.2) * amp * 0.8
          const endX = Math.sin(phase * 0.4 + i * 3) * radius * 0.8
          const endY = Math.cos(phase * 0.6 + i * 2) * radius * 0.5

          const curveHue = (hue + energy * 60 + i * 40) % 360
          ctx.strokeStyle = `hsl(${curveHue}, 70%, 40%)`
          ctx.lineWidth = (1.5 + energy * 3) * kScl
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY)
          ctx.stroke()
        }

        ctx.save()
        ctx.scale(-1, 1)
        for (let i = 0; i < 3; i++) {
          const phase = time * (0.3 + i * 0.15) + i * 2.1
          const amp = (80 + energy * 400) * kScl
          const cp1x = Math.sin(phase) * amp
          const cp1y = Math.cos(phase * 0.7 + i) * amp * 0.6
          const cp2x = Math.cos(phase * 1.3 + i * 0.5) * amp
          const cp2y = Math.sin(phase * 0.5 + i * 1.2) * amp * 0.8
          const endX = Math.sin(phase * 0.4 + i * 3) * radius * 0.8
          const endY = Math.cos(phase * 0.6 + i * 2) * radius * 0.5

          const curveHue = (hue + energy * 60 + i * 40) % 360
          ctx.strokeStyle = `hsl(${curveHue}, 70%, 40%)`
          ctx.lineWidth = (1.5 + energy * 3) * kScl
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY)
          ctx.stroke()
        }
        ctx.restore()

        ctx.restore()
      }

      ctx.restore()
    }

    drawKaleido()
    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      if (!canvas) return
      const rect = canvas.parentElement?.getBoundingClientRect()
      if (!rect) return
      canvas.width = Math.max(1, rect.width * devicePixelRatio)
      canvas.height = Math.max(1, rect.height * devicePixelRatio)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
    }
    resize()

    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    function draw() {
      if (!canvas || !ctx) return
      rafRef.current = requestAnimationFrame(draw)

      const { audioData, beat: isBeat, energy, isPlaying } = useAudioStore.getState()
      const pp = paramsRef.current
      const barCount = Math.max(20, Math.min(MAX_BAR_COUNT, Math.floor(pp.barCount)))
      const smooth = pp.smoothing
      const wScl = cardDimsRef.current.scl

      prevEnergyRef.current = energy

      if (isBeat) {
        bloomIntensityRef.current = 1.0
        cardGlowRef.current = 1.0
        cardBorderAlphaRef.current = 0.25
      } else {
        bloomIntensityRef.current *= 0.97
        cardGlowRef.current *= 0.975
        cardBorderAlphaRef.current += (0.08 - cardBorderAlphaRef.current) * 0.06
      }

      const barTarget = targetColorByEnergy(energy, COLOR_LOW, COLOR_MID, COLOR_HIGH)
      const glowTarget = targetColorByEnergy(energy, GLOW_LOW, GLOW_MID, GLOW_HIGH)
      const lerpT = 0.08
      barColorRef.current = lerpRGBA(barColorRef.current, barTarget, lerpT)
      glowColorRef.current = lerpRGBA(glowColorRef.current, glowTarget, lerpT)

      if (cardRef.current) {
        const g = cardGlowRef.current
        const ba = cardBorderAlphaRef.current.toFixed(3)
        cardRef.current.style.boxShadow =
          `0 2px 4px rgba(0,0,0,0.8),` +
          `0 8px 16px rgba(0,0,0,0.6),` +
          `0 20px 40px rgba(0,0,0,0.4),` +
          `0 0 0 1px rgba(255,255,255,0.06),` +
          `inset 0 1px 0 rgba(255,255,255,0.1),` +
          `inset 0 -1px 0 rgba(0,0,0,0.3),` +
          `0 0 ${(g * 30 * wScl).toFixed(1)}px rgba(120,80,255,${(g * 0.3).toFixed(3)}),` +
          `0 0 ${(g * 60 * wScl).toFixed(1)}px rgba(80,120,255,${(g * 0.15).toFixed(3)})`
        const bc = barColorRef.current
        cardRef.current.style.border = `1px solid rgba(${Math.round(bc.r)},${Math.round(bc.g)},${Math.round(bc.b)},${ba})`
      }

      const w = canvas.width
      const h = canvas.height
      const centerY = h / 2

      ctx.clearRect(0, 0, w, h)

      const totalGap = Math.max(1, devicePixelRatio) * (barCount - 1)
      const barW = (w - totalGap) / barCount
      const gap = Math.max(1, devicePixelRatio)
      const maxH = 22 * devicePixelRatio * Math.max(wScl, 0.6)
      const dataLen = audioData.length || 1

      const bloom = bloomIntensityRef.current
      const barCol = barColorRef.current

      ctx.shadowBlur = (4 + energy * 60 + bloom * 30) * wScl * pp.glow
      ctx.shadowColor = rgbaStr({ ...barCol, a: 0.9 })

      for (let i = 0; i < barCount; i++) {
        if (isPlaying) {
          const idx = Math.floor((i / barCount) * dataLen)
          const raw = (audioData[idx] ?? 0) * 150
          const clamped = Math.min(Math.max(raw, 0), maxH)
          smoothRef.current[i] = smoothRef.current[i] * smooth + clamped * (1 - smooth)
        } else {
          smoothRef.current[i] *= 0.95
        }

        const barH = smoothRef.current[i]
        const x = i * (barW + gap)
        ctx.fillStyle = rgbaStr(barCol)
        ctx.fillRect(x, centerY - barH, barW, barH)
        ctx.fillRect(x, centerY, barW, barH)
      }

      ctx.shadowBlur = (20 + bloom * 40) * wScl * pp.glow
      ctx.shadowColor = rgbaStr({ ...barCol, a: 0.6 })
      ctx.globalAlpha = 0.3

      for (let i = 0; i < barCount; i++) {
        const barH = smoothRef.current[i]
        const x = i * (barW + gap)
        ctx.fillStyle = rgbaStr(barCol)
        ctx.fillRect(x, centerY - barH, barW, barH)
        ctx.fillRect(x, centerY, barW, barH)
      }

      const chromaShift = (1 + energy * 8 + bloom * 3) * Math.max(wScl, 0.5) * pp.chromaShift
      ctx.globalAlpha = 0.35
      ctx.shadowBlur = 0

      ctx.fillStyle = `rgba(255,80,180,0.6)`
      for (let i = 0; i < barCount; i++) {
        const barH = smoothRef.current[i]
        const x = i * (barW + gap)
        ctx.fillRect(x - chromaShift, centerY - barH, barW, barH)
        ctx.fillRect(x - chromaShift, centerY, barW, barH)
      }

      ctx.fillStyle = `rgba(80,180,255,0.6)`
      for (let i = 0; i < barCount; i++) {
        const barH = smoothRef.current[i]
        const x = i * (barW + gap)
        ctx.fillRect(x + chromaShift, centerY - barH, barW, barH)
        ctx.fillRect(x + chromaShift, centerY, barW, barH)
      }

      ctx.globalAlpha = 1.0
      ctx.shadowBlur = 0
    }

    draw()
    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [])

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    const ctx = overlay.getContext('2d')
    if (!ctx) return

    let rafId = 0

    function resize() {
      if (!overlay) return
      overlay.width = overlay.offsetWidth * devicePixelRatio
      overlay.height = overlay.offsetHeight * devicePixelRatio
    }
    resize()

    const ro = new ResizeObserver(() => {
      resize()
      const d = cardDimsRef.current
      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
        makeParticle(overlay.width, overlay.height, d.w, d.h, d.scl)
      )
      geoParticlesRef.current = Array.from({ length: GEO_PARTICLE_COUNT }, () =>
        makeGeoParticle(overlay.width, overlay.height, d.scl)
      )
    })
    ro.observe(overlay)

    interface SparkP { x: number; y: number; vx: number; vy: number; size: number; life: number; maxLife: number; hue: number }
    const sparksArr: SparkP[] = []

    {
      const d = cardDimsRef.current
      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
        makeParticle(overlay.width, overlay.height, d.w, d.h, d.scl)
      )
      geoParticlesRef.current = Array.from({ length: GEO_PARTICLE_COUNT }, () =>
        makeGeoParticle(overlay.width, overlay.height, d.scl)
      )
    }

    function drawOverlay() {
      if (!overlay || !ctx) return
      rafId = requestAnimationFrame(drawOverlay)

      const { beat: isBeat, energy, isPlaying } = useAudioStore.getState()
      const audioNow = useAudioStore.getState().audioData
      let highSum = 0
      for (let i = 80; i < 120; i++) highSum += Math.abs(audioNow[i] ?? 0)
      const highAmt = highSum / 40

      const d = cardDimsRef.current
      const sScl = d.shakeScl
      const pScl = d.scl

      const prevBeatRef = (drawOverlay as unknown as { _prevBeat?: boolean })
      if (isPlaying) {
        const beatHit = isBeat && !prevBeatRef._prevBeat
        prevBeatRef._prevBeat = isBeat
        if (beatHit) {
          traumaRef.current = Math.min(1, traumaRef.current + (energy > 0.05 ? 1.2 : 0.7))
          const kickAngle = Math.random() * Math.PI * 2
          const kickPower = (energy > 0.05 ? 22 : 12) * sScl
          kickXRef.current = Math.cos(kickAngle) * kickPower
          kickYRef.current = Math.sin(kickAngle) * kickPower
        }
        kickXRef.current *= 0.7
        kickYRef.current *= 0.7
        traumaRef.current *= 0.88
        const tPow = traumaRef.current * traumaRef.current
        const pt = performance.now() * 0.015
        const targetShakeX = (Math.sin(pt * 2.1) + Math.sin(pt * 3.7)) * 0.5 * tPow * 28 * sScl
        const targetShakeY = (Math.sin(pt * 1.9) + Math.sin(pt * 3.3)) * 0.5 * tPow * 22 * sScl
        shakeVXRef.current += (targetShakeX - shakeXRef.current) * 0.4
        shakeVXRef.current *= 0.55
        shakeXRef.current += shakeVXRef.current
        shakeVYRef.current += (targetShakeY - shakeYRef.current) * 0.4
        shakeVYRef.current *= 0.55
        shakeYRef.current += shakeVYRef.current
      } else {
        shakeXRef.current *= 0.9
        shakeYRef.current *= 0.9
        shakeVXRef.current *= 0.85
        shakeVYRef.current *= 0.85
        kickXRef.current *= 0.85
        kickYRef.current *= 0.85
        traumaRef.current *= 0.85
      }

      if (isPlaying) {
        const jt = performance.now() * 0.04
        const targetJX = Math.sin(jt * 3.1 + highAmt * 10) * highAmt * 12 * sScl
        const targetJY = Math.cos(jt * 2.7 + highAmt * 8) * highAmt * 9 * sScl
        jitterXRef.current += (targetJX - jitterXRef.current) * 0.35
        jitterYRef.current += (targetJY - jitterYRef.current) * 0.35
      } else {
        jitterXRef.current *= 0.88
        jitterYRef.current *= 0.88
      }

      const sparkData = useAudioStore.getState().audioData
      const sparkCap = energy > 0.05 ? 90 : 60
      const sparkProb = energy > 0.05 ? 0.22 : 0.12
      if (isPlaying && sparksArr.length < sparkCap) {
        for (let i = 20; i < 100; i += 8) {
          const amp = Math.abs(sparkData[i] ?? 0)
          if (amp > 0.3 && Math.random() < sparkProb) {
            const ang = Math.random() * Math.PI * 2
            const cardX = posXRef.current * devicePixelRatio + shakeXRef.current * devicePixelRatio + kickXRef.current * devicePixelRatio
            const cardY = posYRef.current * devicePixelRatio + shakeYRef.current * devicePixelRatio + kickYRef.current * devicePixelRatio
            sparksArr.push({
              x: cardX + (Math.random() - 0.5) * d.w * devicePixelRatio,
              y: cardY + (Math.random() - 0.5) * d.h * devicePixelRatio,
              vx: Math.cos(ang) * (1 + Math.random() * 2) * devicePixelRatio * pScl,
              vy: Math.sin(ang) * (1 + Math.random() * 2) * devicePixelRatio * pScl - 0.5,
              size: (1.2 + Math.random() * 1.5) * devicePixelRatio * pScl,
              life: 25 + Math.random() * 15,
              maxLife: 40,
              hue: (hueRef.current + Math.random() * 60) % 360,
            })
          }
        }
      }

      const w = overlay.width
      const h = overlay.height
      const cx = w / 2
      const cy = h / 2
      const cardTop = cy - (d.h / 2) * devicePixelRatio

      if (isPlaying) timeRef.current += 0.016
      const t = timeRef.current
      const screenW = window.innerWidth
      const screenH = window.innerHeight

      targetXRef.current = screenW / 2 + Math.sin(t * 0.15) * 60 * sScl
      targetYRef.current = screenH / 2 + Math.cos(t * 0.12) * 40 * sScl

      posXRef.current += (targetXRef.current - posXRef.current) * 0.008
      posYRef.current += (targetYRef.current - posYRef.current) * 0.008

      posXRef.current += velXRef.current
      posYRef.current += velYRef.current
      velXRef.current *= 0.95
      velYRef.current *= 0.95

      cardBeatScaleRef.current = 1.0 + (cardBeatScaleRef.current - 1.0) * 0.88
      const cardScale = cardBeatScaleRef.current

      const targetOpacity = isPlaying ? 1.0 : 0.6
      cardOpacityRef.current += (targetOpacity - cardOpacityRef.current) * 0.05

      const targetBlur = isPlaying ? 0 : 4
      globalBlurRef.current += (targetBlur - globalBlurRef.current) * 0.04
      if (rootRef.current) {
        const b = globalBlurRef.current
        rootRef.current.style.filter = b > 0.15 ? `blur(${b.toFixed(2)}px)` : 'none'
      }

      const bgTargetR = lerpNum(5, 13, Math.min(energy / 0.12, 1))
      const bgTargetG = lerpNum(5, 5, Math.min(energy / 0.12, 1))
      const bgTargetB = lerpNum(16, 21, Math.min(energy / 0.12, 1))
      bgRedRef.current += (bgTargetR - bgRedRef.current) * 0.05
      bgGreenRef.current += (bgTargetG - bgGreenRef.current) * 0.05
      bgBlueRef.current += (bgTargetB - bgBlueRef.current) * 0.05

      if (cardRef.current) {
        cardRef.current.style.left = `${posXRef.current - d.w / 2 + shakeXRef.current + kickXRef.current + jitterXRef.current}px`
        cardRef.current.style.top = `${posYRef.current - d.h / 2 + shakeYRef.current + kickYRef.current + jitterYRef.current}px`
        const jitterVel = Math.abs(jitterXRef.current) + Math.abs(jitterYRef.current)
        const motionMag = Math.sqrt(shakeVXRef.current * shakeVXRef.current + shakeVYRef.current * shakeVYRef.current)
        const blurAmount = Math.min(4, motionMag * 1.5 + jitterVel * 0.03 + highAmt * 1.5)
        cardRef.current.style.transform = `scale(${cardScale})`
        cardRef.current.style.filter = blurAmount > 0.2 ? `blur(${blurAmount.toFixed(1)}px)` : 'none'
        cardRef.current.style.opacity = String(cardOpacityRef.current)
      }

      if (isPlaying) coverRotRef.current += 0.1
      if (coverRef.current) {
        coverRef.current.style.transform = `rotate(${coverRotRef.current}deg)`
      }

      ctx.clearRect(0, 0, w, h)

      if (isPlaying) hueRef.current += 0.1
      if (isBeat && isPlaying) hueRef.current += 20
      const hue = hueRef.current % 360

      if (!hasCoverRef.current) {
        const h1 = `hsl(${hue}, 60%, 8%)`
        const h2 = `hsl(${(hue + 120) % 360}, 60%, 5%)`
        const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7)
        bgGrad.addColorStop(0, h1)
        bgGrad.addColorStop(1, h2)
        ctx.fillStyle = bgGrad
        ctx.fillRect(0, 0, w, h)
      }

      const gradOpacity = 0.03 + energy * 0.05
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.6)
      grad.addColorStop(0, `rgba(255, 255, 255, ${gradOpacity})`)
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)

      const particles = particlesRef.current

      for (const p of particles) {
        if (isPlaying) {
          const maxTrail = p.type === 'D' ? TRAIL_LEN_D : TRAIL_LEN_ALL
          p.trail.push({ x: p.x, y: p.y })
          if (p.trail.length > maxTrail) p.trail.shift()

          if (p.type === 'A') {
            if (p.orbitBurstFrames > 0) {
              p.orbitRadius += (p.orbitBaseRadius - p.orbitRadius) * 0.05
              p.orbitBurstFrames--
            }
            if (isBeat) {
              p.orbitRadius = p.orbitBaseRadius * 1.5
              p.orbitBurstFrames = 60
            }
            p.angle += p.angleSpeed
            p.x = p.orbitCx + Math.cos(p.angle) * p.orbitRadius
            p.y = p.orbitCy + Math.sin(p.angle) * p.orbitRadius

          } else if (p.type === 'B') {
            if (isBeat) {
              p.vx += (Math.random() - 0.5) * 6 * pScl
              p.vy += (Math.random() - 0.5) * 6 * pScl
            }
            p.vx += (cx - p.x) * 0.0001
            p.vy += (cy - p.y) * 0.0001
            p.vx *= 0.99
            p.vy *= 0.99
            p.x += p.vx
            p.y += p.vy

          } else if (p.type === 'C') {
            if (isBeat) {
              p.vy = -2 * devicePixelRatio * pScl
            }
            p.y += p.vy
            p.x += p.vx
            if (p.y < cardTop - 50 * devicePixelRatio) {
              p.x = cx + (Math.random() - 0.5) * d.w * devicePixelRatio
              p.y = cy + (d.h / 2) * devicePixelRatio + Math.random() * 20
              p.vy = -(0.3 + Math.random() * 0.3) * devicePixelRatio * pScl
            }

          } else {

            if (isBeat) {
              p.shooting = true
              const dx = p.homeX - cx
              const dy = p.homeY - cy
              const len = Math.sqrt(dx * dx + dy * dy) || 1
              const speed = (4 + Math.random() * 3) * devicePixelRatio * pScl
              p.vx = (dx / len) * speed + (Math.random() - 0.5) * 2
              p.vy = (dy / len) * speed + (Math.random() - 0.5) * 2
            }
            if (p.shooting) {
              p.x += p.vx
              p.y += p.vy
              p.vx *= 0.96
              p.vy *= 0.96
              if (Math.abs(p.vx) < 0.3 && Math.abs(p.vy) < 0.3) {
                p.shooting = false
              }
            } else {
              p.x += (p.homeX - p.x) * 0.02
              p.y += (p.homeY - p.y) * 0.02
            }
          }
        }

        const particleHue = (hue + p.opacity * 60) % 360
        const pColor = `hsla(${particleHue}, 70%, 80%,`

        if (p.trail.length > 1) {
          ctx.save()
          ctx.shadowBlur = 0
          for (let ti = 0; ti < p.trail.length - 1; ti++) {
            const t0 = p.trail[ti]!
            const t1 = p.trail[ti + 1]!
            const tAlpha = ((ti + 1) / p.trail.length) * 0.1
            ctx.strokeStyle = `${pColor}${tAlpha.toFixed(3)})`
            ctx.lineWidth = p.size * 0.6
            ctx.beginPath()
            ctx.moveTo(t0.x, t0.y)
            ctx.lineTo(t1.x, t1.y)
            ctx.stroke()
          }
          ctx.restore()
        }

        ctx.shadowBlur = p.size * 4
        ctx.shadowColor = `${pColor}0.6)`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `${pColor}${p.opacity})`
        ctx.fill()
      }

      ctx.shadowBlur = 0

      const geoP = geoParticlesRef.current
      for (const gp of geoP) {
        if (isPlaying) {
          gp.rotation += gp.rotationSpeed

          if (isBeat) {
            const dx = gp.x - cx
            const dy = gp.y - cy
            const len = Math.sqrt(dx * dx + dy * dy) || 1
            gp.vx = (dx / len) * 3 * pScl + (Math.random() - 0.5) * 2
            gp.vy = (dy / len) * 3 * pScl + (Math.random() - 0.5) * 2
            gp.burstFrames = 40
          }

          if (gp.burstFrames > 0) {
            gp.x += gp.vx
            gp.y += gp.vy
            gp.vx *= 0.96
            gp.vy *= 0.96
            gp.burstFrames--
          } else {
            gp.x += (Math.random() - 0.5) * 0.3
            gp.y += (Math.random() - 0.5) * 0.3
            gp.x += (gp.baseX - gp.x) * 0.005
            gp.y += (gp.baseY - gp.y) * 0.005
          }
        }
        drawGeoShape(ctx, gp, pScl)
      }

      for (let i = sparksArr.length - 1; i >= 0; i--) {
        const s = sparksArr[i]
        if (isPlaying) {
          s.x += s.vx
          s.y += s.vy
          s.vx *= 0.93
          s.vy *= 0.93
          s.life--
        }
        if (s.life <= 0) { sparksArr.splice(i, 1); continue }
        const a = s.life / s.maxLife
        const gradS = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 5)
        gradS.addColorStop(0, `hsla(${s.hue},90%,75%,${a * 0.7})`)
        gradS.addColorStop(1, `hsla(${s.hue},90%,50%,0)`)
        ctx.fillStyle = gradS
        ctx.fillRect(s.x - s.size * 5, s.y - s.size * 5, s.size * 10, s.size * 10)
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size * a, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${s.hue},90%,95%,${a})`
        ctx.fill()
      }

      ctx.fillStyle = 'rgba(255,255,255,0.015)'
      for (let i = 0; i < 120; i++) {
        ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1)
      }

      const vign = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.35, cx, cy, Math.max(w, h) * 0.7)
      vign.addColorStop(0, 'rgba(0,0,0,0)')
      vign.addColorStop(1, 'rgba(0,0,0,0.5)')
      ctx.fillStyle = vign
      ctx.fillRect(0, 0, w, h)
    }

    drawOverlay()
    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [])

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    const d = cardDimsRef.current
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
      makeParticle(overlay.width, overlay.height, d.w, d.h, d.scl)
    )
    geoParticlesRef.current = Array.from({ length: GEO_PARTICLE_COUNT }, () =>
      makeGeoParticle(overlay.width, overlay.height, d.scl)
    )

    posXRef.current = W / 2
    posYRef.current = H / 2
    targetXRef.current = W / 2
    targetYRef.current = H / 2
  }, [W, H, cardW, cardH])

  const { trackInfo, currentTime } = useAudioStore()
  const hasCover = trackInfo.cover.length > 0
  hasCoverRef.current = hasCover

  const hasTrack = trackInfo.title.length > 0
  const trackChanged = prevTrackRef.current !== trackInfo.title
  if (trackChanged) prevTrackRef.current = trackInfo.title

  return (
    <div ref={rootRef} style={{
      position: 'fixed',
      inset: 0,
      overflow: 'hidden',
      willChange: 'filter',
    }}>

      {hasCover ? (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${trackInfo.cover})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(60px) brightness(0.25) saturate(1.5)',
          transform: 'scale(1.3)',
        }} />
      ) : (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `rgb(${Math.round(bgRedRef.current)},${Math.round(bgGreenRef.current)},${Math.round(bgBlueRef.current)})`,
        }} />
      )}

      <canvas
        ref={kaleidoRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />

      {/* оверлей частиц и градиента */}
      <canvas
        ref={overlayRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />

      {/* карточка */}
      <div ref={cardRef} style={{
        position: 'absolute',
        left: W / 2 - cardW / 2,
        top: H / 2 - cardH / 2,
        width: cardW,
        height: cardH,
        background: 'rgba(10,10,20,0.75)',
        borderRadius: Math.round(20 * Math.max(scl, 0.5)),
        backdropFilter: 'blur(20px) saturate(1.8)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.8), 0 8px 16px rgba(0,0,0,0.6), 0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: isVertical ? 'column' : 'row',
        alignItems: 'center',
        willChange: 'transform, opacity, left, top',
      }}>
        {/* внутренняя текстура */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)',
          pointerEvents: 'none',
        }} />

        {/* обложка */}
        <div style={{
          margin: isVertical ? `${coverMargin}px ${coverMargin}px ${Math.round(coverMargin * 0.5)}px` : coverMargin,
          flexShrink: 0,
        }}>
          {hasCover ? (
            <img
              ref={coverRef}
              src={trackInfo.cover}
              alt="cover"
              style={{
                width: coverSize,
                height: coverSize,
                borderRadius: Math.round(12 * Math.max(scl, 0.5)),
                objectFit: 'cover',
              }}
            />
          ) : (
            <div style={{
              width: coverSize,
              height: coverSize,
              borderRadius: Math.round(12 * Math.max(scl, 0.5)),
              background: 'rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: placeholderFontSize,
              color: 'rgba(255,255,255,0.2)',
            }}>
              ♪
            </div>
          )}
        </div>

        {/* инфо и визуализация */}
        <div style={{
          flex: 1,
          minWidth: 0,
          width: isVertical ? '100%' : undefined,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingLeft: isVertical ? coverMargin : 0,
          paddingRight: isVertical ? coverMargin : Math.round(16 * Math.max(scl, 0.5)),
          textAlign: isVertical ? 'center' : 'left',
          alignItems: isVertical ? 'center' : 'stretch',
        }}>
          {trackInfo.artist && (
            <div style={{
              fontSize: artistFontSize,
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              letterSpacing: 2,
              marginBottom: Math.round(2 * Math.max(scl, 0.5)),
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
              animation: trackChanged ? 'card-fadein 0.5s ease' : undefined,
            }}>
              {trackInfo.artist}
            </div>
          )}
          <div style={{
            fontSize: titleFontSize,
            fontWeight: 700,
            color: hasTrack ? '#fff' : 'rgba(255,255,255,0.3)',
            marginBottom: Math.round(12 * Math.max(scl, 0.5)),
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
            animation: trackChanged ? 'card-fadein 0.5s ease' : undefined,
          }}>
            {hasTrack ? trackInfo.title : 'Загрузи трек'}
          </div>
          <canvas ref={canvasRef} style={{ width: '100%', height: waveHeight }} />
        </div>

        <div style={{
          padding: isVertical
            ? `${Math.round(coverMargin * 0.5)}px 0`
            : `0 ${coverMargin}px`,
          flexShrink: 0,
          fontSize: timeFontSize,
          fontFamily: 'monospace',
          color: 'rgba(255,255,255,0.4)',
        }}>
          {formatTime(currentTime)}
        </div>

        <div style={{
          position: 'absolute',
          bottom: -Math.round(14 * Math.max(scl, 0.5)),
          left: 0,
          width: '100%',
          height: Math.max(2, Math.round(2 * Math.max(scl, 0.7))),
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 1,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            background: '#fff',
            boxShadow: '0 0 8px rgba(255,255,255,0.5)',
            width: '0%',
          }} />
        </div>
      </div>

      <style>{`
        @keyframes card-fadein {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
