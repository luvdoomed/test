import { useEffect, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'
import { useVisualizerParams } from '../presets/useVisualizerParams'

interface WitchscopeParams {
  ringSize: number
  trailFade: number
  scanSpeed: number
  beamMax: number
  glow: number
}

const SEGMENT_COUNT = 120
const RING_RADIUS = 140
const TWO_PI = Math.PI * 2
const SEG_ARC = TWO_PI / SEGMENT_COUNT

const CORONA_SCALES = [1.06, 1.12, 1.2] as const
const CORONA_OPACITIES = [0.2, 0.1, 0.05] as const
const CORONA_BLURS = [8, 14, 22] as const

const BEAM_COLORS = ['#ff0022', '#00ff44', '#ffffff', '#ff44ff', '#00ffff']
const BEAM_MIN = 0

interface LaserBeam {
  x: number
  angle: number
  color: string
  width: number
  life: number
  maxLife: number
}

interface AtmosphereParticle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
}

const PARTICLE_COUNT = 30

interface GlitchSlice {
  y: number
  h: number
  dx: number
  frames: number
}

interface ShockwavePuff {
  ax: number
  ay: number
  ar: number
}

interface Shockwave {
  x: number
  y: number
  life: number
  maxLife: number
  puffs: ShockwavePuff[]
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function WitchscopeVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const beamsRef = useRef<LaserBeam[]>([])
  const particlesRef = useRef<AtmosphereParticle[]>([])
  const glitchRef = useRef<GlitchSlice[]>([])
  const shakeStateRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, trauma: 0 })
  const ringPulseRef = useRef(0)
  const progressRef = useRef(0)
  const shockwaveRef = useRef<Shockwave[]>([])
  const currentRingColorRef = useRef('#00ff66')
  const prevShakeXRef = useRef(0)
  const prevShakeYRef = useRef(0)
  const velXRef = useRef(0)
  const velYRef = useRef(0)
  const timeRef = useRef(0)
  const cameraDriftRef = useRef({ x: 0, y: 0, rot: 0, scale: 1 })

  const params = useVisualizerParams<WitchscopeParams>('witchscope')
  const paramsRef = useRef(params)
  paramsRef.current = params

  useEffect(() => {
    if (!document.getElementById('vcr-osd-font')) {
      const style = document.createElement('style')
      style.id = 'vcr-osd-font'
      style.textContent = `
        @font-face {
          font-family: 'VCR OSD Mono';
          src: url('https://cdn.jsdelivr.net/gh/Honestyy/[email protected]/VCR_OSD_MONO_1.001.ttf') format('truetype');
          font-display: swap;
        }
      `
      document.head.appendChild(style)
    }
  }, [])

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

    const ringColorRGB = { r: 0, g: 255, b: 102 }

    if (particlesRef.current.length === 0) {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particlesRef.current.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: 1 + Math.random(),
          opacity: 0.1 + Math.random() * 0.1,
        })
      }
    }

    function drawRing(
      ctx: CanvasRenderingContext2D,
      cx: number, cy: number,
      audioData: Float32Array,
      color: string | null,
      radius: number,
}}
))
