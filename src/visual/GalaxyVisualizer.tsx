import { useEffect, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'
import { useVisualizerParams } from '../presets/useVisualizerParams'

interface GalaxyParams {
  starCount: number
  speed: number
  hueShift: number
  nebulaIntensity: number
  trailFade: number
}

const MAX_STAR_COUNT = 5000
const MAX_DEPTH = 2000
const FOCAL_LENGTH = 300
const BASE_SPEED = 1.5
const MAX_ENERGY_SPEED = 15
const SHAKE_DECAY = 0.85
const SHAKE_STRENGTH = 5
const NEBULA_CLOUD_COUNT = 5
const NEBULA_GRADIENTS_PER_CLOUD = 3
const WARP_FLASH_DECAY = 0.85
const BEAT_SPEED_BURST = 8
const CLOUD_LAYER_COUNT = 15
const CLOUD_MAX_ACTIVE = 3
const CLOUD_MAX_FRAMES = 35
const CLOUD_DECAY = 0.93
const SHOOTING_STAR_MIN_INTERVAL = 180 // ~3с при 60fps
const SHOOTING_STAR_MAX_INTERVAL = 480 // ~8с
const SHOOTING_STAR_SPEED = 12
const SHOOTING_STAR_TRAIL_LENGTH = 25
const FREQ_BANDS = 8
const HUE_SHIFT_SPEED = 0.05 // полный цикл ~2мин
const enum StarColor { White, WarmYellow, Bright }

interface NebulaGradient {
  offsetX: number
  offsetY: number
  radius: number
  r: number
  g: number
  b: number
  baseAlpha: number
}

interface NebulaCloud {
  x: number
  y: number
  vx: number
  vy: number
  gradients: NebulaGradient[]
}

const NEBULA_PALETTES: Array<[number, number, number, number][]> = [
  [[30, 50, 150, 0.06], [40, 30, 170, 0.05], [20, 60, 130, 0.04]],
  [[80, 20, 120, 0.05], [100, 10, 140, 0.04], [60, 30, 110, 0.05]],
  [[10, 80, 100, 0.04], [20, 70, 120, 0.05], [10, 90, 80, 0.04]],
  [[50, 30, 140, 0.05], [30, 50, 150, 0.06], [80, 20, 120, 0.04]],
  [[10, 80, 100, 0.04], [80, 20, 120, 0.05], [30, 50, 150, 0.05]],
]

function createNebulaCloud(lw: number, lh: number, paletteIdx: number): NebulaCloud {
  const palette = NEBULA_PALETTES[paletteIdx % NEBULA_PALETTES.length]
  const gradients: NebulaGradient[] = []
  for (let i = 0; i < NEBULA_GRADIENTS_PER_CLOUD; i++) {
    const [r, g, b, baseAlpha] = palette[i]
    gradients.push({
      offsetX: (Math.random() - 0.5) * 100,
      offsetY: (Math.random() - 0.5) * 100,
      radius: 200 + Math.random() * 300,
      r, g, b, baseAlpha,
    })
  }
  return {
    x: Math.random() * lw,
    y: Math.random() * lh,
    vx: (Math.random() - 0.5) * 0.04,
    vy: (Math.random() - 0.5) * 0.04,
    gradients,
  }
}

interface CloudLayer {
  ox: number
  oy: number
  z: number
  vx: number
  vy: number
  baseRadius: number
  angle: number
}

interface VolumetricCloud {
  x: number
  y: number
  layers: CloudLayer[]
  opacity: number
  age: number
}

function createVolumetricCloud(x: number, y: number): VolumetricCloud {
  const layers: CloudLayer[] = []
  for (let i = 0; i < CLOUD_LAYER_COUNT; i++) {
    layers.push({
      ox: (Math.random() - 0.5) * 60,
      oy: (Math.random() - 0.5) * 60,
}}}
)
