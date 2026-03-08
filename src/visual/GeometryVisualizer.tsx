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
}
