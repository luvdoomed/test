import { useEffect, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'
import { useVisualizerParams } from '../presets/useVisualizerParams'

interface ParticlesParams {
  particleCount: number
  speed: number
  trailLength: number
  connectionDist: number
  hueShift: number
}

const PARTICLE_COUNT = 200
const MAX_CONNECTIONS = 3
const PULSE_FRAMES = 20

interface TrailPoint {
  x: number
  y: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  hue: number          // 0-360, медленно меняется каждый кадр
  orbitDir: 1 | -1    // направление вращения
  life: number
  lifeSpeed: number
  trail: TrailPoint[]
}

function spawnParticle(W: number, H: number, cx?: number, cy?: number): Particle {
  return {
    x: cx ?? Math.random() * W,
    y: cy ?? Math.random() * H,
    vx: (Math.random() - 0.5) * 1.5,
    vy: (Math.random() - 0.5) * 1.5,
    size: 1 + Math.random() * 3,
    opacity: 0.6 + Math.random() * 0.4,
    hue: Math.random() * 360,
    orbitDir: Math.random() > 0.5 ? 1 : -1,
    life: 0.6 + Math.random() * 0.4,
    lifeSpeed: 0.003 + Math.random() * 0.005,
    trail: [],
  }
}

export function ParticlesVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const particlesRef = useRef<Particle[]>([])
  const prevBeatRef = useRef<boolean>(false)
  const pulseSizeRef = useRef<number>(1)
  const flashFramesRef = useRef<number>(0)
}
