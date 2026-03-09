import { useEffect, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'

const SHAPE_COUNT = 25
const LINE_SPACING = 35
const VLINE_SPACING = 60
const LERP_BACK = 0.96
const BEAT_SCALE = 1.5
const SCALE_DECAY = 0.88
const FLASH_ALPHA = 0.12
const SPARK_MAX = 40
const SPARK_BANDS = 8

type ShapeKind = 'square' | 'diamond' | 'cross' | 'triangle'

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  hue: number
  life: number
  maxLife: number
}

interface GeoShape {
  baseX: number
  baseY: number
  individualPhase: number
  size: number        // базовый размер
  kind: ShapeKind
  nested: boolean
  rotation: number
  rotSpeed: number
  freqIndex: number   // индекс частотной полосы
}

interface SyncState {
  globalOffsetX: number
  globalOffsetY: number
  beatScale: number
  flashAlpha: number
  beatFlash: number   // 1.0 на бит, затухает * 0.75 каждый кадр
  beatFlashTimer: number // для первых 2 кадров жёсткой вспышки
  glitchTimer: number
  lineBrightness: number
  energy: number
  time: number
  cameraScaleBurst: number // доп. зум на бит, затухает * 0.92
}

function createShapes(w: number, h: number): GeoShape[] {
  const shapes: GeoShape[] = []
  const cols = 5
  const rows = 5
  const cellW = w / (cols + 1)
  const cellH = h / (rows + 1)

  for (let i = 0; i < SHAPE_COUNT; i++) {
    const col = i % cols
    const row = Math.floor(i / cols) % rows
    const baseX = cellW * (col + 1) + (Math.random() - 0.5) * cellW * 0.6
    const baseY = cellH * (row + 1) + (Math.random() - 0.5) * cellH * 0.6
    const size = Math.random() * 8 + 6
    shapes.push({
      baseX,
      baseY,
      individualPhase: Math.random() * Math.PI * 2,
      size,
      kind: ((): ShapeKind => { const r = Math.random(); return r < 0.3 ? 'square' : r < 0.6 ? 'diamond' : r < 0.8 ? 'cross' : 'triangle' })(),
      nested: Math.random() < 0.4,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.008,
      freqIndex: (i * 5) % 1024,
    })
  }
  return shapes
}

function strokeSquare(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
  opacity: number,
  glow: number,
  color = '#ffffff',
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.globalAlpha = opacity
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.shadowBlur = glow
  ctx.shadowColor = '#ffffff'
  const s = size / 2
  ctx.strokeRect(-s, -s, size, size)
  ctx.restore()
}

function strokeCross(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
  opacity: number,
  glow: number,
  color = '#ffffff',
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.globalAlpha = opacity
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.shadowBlur = glow
  ctx.shadowColor = '#ffffff'
  const half = size / 2
  ctx.strokeRect(-1, -half, 2, size)
  ctx.strokeRect(-half, -1, size, 2)
  ctx.restore()
}

function strokeTriangle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
  opacity: number,
  glow: number,
  color = '#ffffff',
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.globalAlpha = opacity
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.shadowBlur = glow
  ctx.shadowColor = '#ffffff'
  const h = size / 2
  ctx.beginPath()
  ctx.moveTo(0, -h)
  ctx.lineTo(-h, h)
  ctx.lineTo(h, h)
  ctx.closePath()
  ctx.stroke()
  ctx.restore()
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  kind: ShapeKind,
  x: number,
  y: number,
  size: number,
  rotation: number,
  opacity: number,
  glow: number,
  color = '#ffffff',
) {
  if (kind === 'square') {
    strokeSquare(ctx, x, y, size, rotation, opacity, glow, color)
  } else if (kind === 'diamond') {
    strokeSquare(ctx, x, y, size, rotation + Math.PI / 4, opacity, glow, color)
  } else if (kind === 'cross') {
    strokeCross(ctx, x, y, size, rotation, opacity, glow, color)
  } else {
    strokeTriangle(ctx, x, y, size, rotation, opacity, glow, color)
  }
}

export function GeometryVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const shapesRef = useRef<GeoShape[]>([])
  const sparksRef = useRef<Spark[]>([])
  const syncRef = useRef<SyncState>({
    globalOffsetX: 0,
    globalOffsetY: 0,
    beatScale: 1,
    flashAlpha: 0,
    beatFlash: 0,
    beatFlashTimer: 0,
    glitchTimer: 0,
    lineBrightness: 0.08,
    energy: 0,
    time: 0,
    cameraScaleBurst: 0,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      shapesRef.current = createShapes(canvas.width, canvas.height)
    }
    resize()
    window.addEventListener('resize', resize)

    function draw() {
      if (!canvas || !ctx) return
      const { beat, isPlaying, audioData } = useAudioStore.getState()
      const W = canvas.width
      const H = canvas.height
      const sync = syncRef.current
      const sizeScale = Math.min(W, H) / 900

      let energy = 0
      if (audioData.length > 0) {
        for (let i = 0; i < audioData.length; i++) energy += Math.abs(audioData[i])
        energy /= audioData.length
      }
      sync.energy += (energy - sync.energy) * 0.15

      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)

      if (isPlaying) {
        sync.time += 1

        sync.globalOffsetX += Math.sin(sync.time * 0.02) * 0.3
        sync.globalOffsetY += Math.cos(sync.time * 0.015) * 0.15

        if (beat) {
          sync.globalOffsetX += (Math.random() - 0.5) * 40 * sizeScale
          sync.globalOffsetY += (Math.random() - 0.5) * 20 * sizeScale
          sync.beatScale = BEAT_SCALE
          sync.flashAlpha = FLASH_ALPHA
          sync.beatFlash = 1.0
          sync.beatFlashTimer = 2
          sync.glitchTimer = 6
          sync.lineBrightness = 0.18
          sync.cameraScaleBurst += 0.1
        }

        sync.globalOffsetX *= LERP_BACK
        sync.globalOffsetY *= LERP_BACK

        sync.beatScale = 1 + (sync.beatScale - 1) * SCALE_DECAY

        sync.flashAlpha *= 0.92
        sync.beatFlash *= 0.75
        sync.cameraScaleBurst *= 0.92
        if (sync.beatFlashTimer > 0) sync.beatFlashTimer--
        if (sync.glitchTimer > 0) sync.glitchTimer--
        sync.lineBrightness += (0.08 - sync.lineBrightness) * 0.06
      }

      if (isPlaying && audioData.length >= 128) {
        const sparks = sparksRef.current

        const spawnSpark = (): void => {
          if (sparks.length >= SPARK_MAX) return
          const x = Math.random() * W
          const y = Math.random() * H
          const maxLife = Math.floor(Math.random() * 21) + 20
          sparks.push({
}}}}}}
))
