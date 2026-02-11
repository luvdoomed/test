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

  const params = useVisualizerParams<ParticlesParams>('particles')
  const paramsRef = useRef(params)
  paramsRef.current = params

  const { beat, audioData, energy } = useAudioStore()

  const beatRef = useRef(beat)
  const audioDataRef = useRef(audioData)
  const energyRef = useRef(energy)
  beatRef.current = beat
  audioDataRef.current = audioData
  energyRef.current = energy

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
        spawnParticle(canvas.width, canvas.height),
      )
    }
    resize()
    window.addEventListener('resize', resize)

    let frameCount = 0

    function draw() {
      if (!canvas || !ctx) return

      const beat = beatRef.current
      const audioData = audioDataRef.current
      const energy = energyRef.current

      const W = canvas.width
      const H = canvas.height
      const cx = W / 2
      const cy = H / 2
      const minDim = Math.min(W, H)
      const sizeScale = minDim / 1080
      const shakeScale = minDim / 900

      const pp = paramsRef.current
      const desiredCount = Math.max(50, Math.min(1000, Math.floor(pp.particleCount)))
      const speedMultParam = Math.max(0, pp.speed)
      const trailLenParam = Math.max(0, Math.min(20, Math.floor(pp.trailLength)))
      const connectionDistParam = Math.max(0, pp.connectionDist)
      const hueShiftParam = pp.hueShift

      while (particlesRef.current.length < desiredCount) {
        particlesRef.current.push(spawnParticle(W, H))
}}}}
)
