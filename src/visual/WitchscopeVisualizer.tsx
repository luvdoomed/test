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
      energyAlpha: number,
      energy: number,
      progress: number,
      lwOverride?: number,
      alphaOverride?: number,
      glowBlur?: number,
    ) {
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.translate(cx, cy)
      ctx.lineCap = 'round'

      const lineScl = Math.min(canvas!.width, canvas!.height) / 1080

      if (glowBlur && color) {
        ctx.shadowColor = color
        ctx.shadowBlur = glowBlur
      }

      const chromaOff = 3 * lineScl
      const channels = color
        ? [{ off: 0, color }]
        : [
            { off: chromaOff, color: '#ff0000' },
            { off: 0, color: '#00ff00' },
            { off: -chromaOff, color: '#0000ff' },
          ]

      const TAIL = TWO_PI * 1.1
      const SEG_ARC_LEN = SEG_ARC * 0.8

      // shadowBlur один раз выше, не в цикле
      for (let i = 0; i < SEGMENT_COUNT; i++) {
        const freq = audioData[Math.floor((i / SEGMENT_COUNT) * (audioData.length || 1024))] ?? 0
        const a = i * SEG_ARC
        const dist = progress - a
        if (dist < 0 || dist > TAIL) continue
        const fade = Math.pow(1 - dist / TAIL, 1.8)

        const lw = lwOverride ?? ((2 + freq * 8) * lineScl)
        const baseAlpha = alphaOverride ?? Math.min(1, (0.3 + freq * 5) * energyAlpha)

        for (const ch of channels) {
          ctx.lineWidth = lw
          ctx.strokeStyle = ch.color
          ctx.globalAlpha = Math.min(1, baseAlpha * fade)
          ctx.beginPath()
          ctx.arc(0, 0, radius + ch.off, a, a + SEG_ARC_LEN)
          ctx.stroke()
        }

        if (dist < 0.15) {
          ctx.strokeStyle = '#ffffff'
          ctx.globalAlpha = 1.0
          ctx.lineWidth = Math.max(3 * lineScl, lw * (1 + energy * 2))
          ctx.beginPath()
          ctx.arc(0, 0, radius, a, a + SEG_ARC_LEN)
          ctx.stroke()
        }
      }

      ctx.shadowBlur = 0

      ctx.restore()
    }

    function spawnBeam(W: number): LaserBeam {
      return {
        x: Math.random() * W,
        angle: (Math.random() * 30 - 15) * Math.PI / 180,
        color: BEAM_COLORS[Math.floor(Math.random() * BEAM_COLORS.length)],
        width: 0.4 + Math.random() * 0.5,
        life: 0,
        maxLife: 60 + Math.random() * 120, // 1-3 сек при 60fps
      }
    }

    function updateAndDrawLasers(
      ctx: CanvasRenderingContext2D,
      W: number, H: number,
      cx: number, cy: number,
      beat: boolean,
      energy: number,
      lineScl: number,
      ringRadiusLocal: number,
      beamMaxLocal: number,
    ) {
      const beams = beamsRef.current

      for (let i = beams.length - 1; i >= 0; i--) {
        if (beams[i].life >= beams[i].maxLife) beams.splice(i, 1)
      }

      if (beat && energy > 0.02 && beams.length < beamMaxLocal && Math.random() < 0.9) {
        beams.push(spawnBeam(W))
      }

      while (beams.length < BEAM_MIN) {
        beams.push(spawnBeam(W))
      }

      ctx.save()
      ctx.globalCompositeOperation = 'screen'

      for (const beam of beams) {
        beam.life++
        const t = beam.life / beam.maxLife
        const fadeIn = Math.min(1, t / 0.15)
        const fadeOut = Math.min(1, (1 - t) / 0.25)
        const opacity = fadeIn * fadeOut

        const sin = Math.sin(beam.angle)
        const x0 = beam.x
        const y0 = H
        const x1 = beam.x - sin * H
        const y1 = 0

        const chOff = 2 * lineScl
        const chromaOffsets = [
          { dx: -chOff, comp: 'red' },
          { dx: 0, comp: 'green' },
          { dx: chOff, comp: 'blue' },
        ]

        for (const chroma of chromaOffsets) {
          const cx0 = x0 + chroma.dx
          const cx1 = x1 + chroma.dx

          ctx.beginPath()
          ctx.moveTo(cx0, y0)
          ctx.lineTo(cx1, y1)
          ctx.strokeStyle = beam.color
          ctx.globalAlpha = opacity * 0.08
          ctx.lineWidth = beam.width * 5 * lineScl
          ctx.shadowColor = currentRingColorRef.current
          ctx.shadowBlur = 10 * lineScl
          ctx.stroke()

          ctx.beginPath()
          ctx.moveTo(cx0, y0)
          ctx.lineTo(cx1, y1)
          ctx.globalAlpha = opacity * 0.2
          ctx.lineWidth = beam.width * 3 * lineScl
          ctx.stroke()

          ctx.beginPath()
          ctx.moveTo(cx0, y0)
          ctx.lineTo(cx1, y1)
          ctx.globalAlpha = opacity * 1.0
          ctx.lineWidth = 1.5
          ctx.stroke()
        }

        ctx.shadowBlur = 0

        const ringY = cy
        const beamAtRingX = x0 + (ringY - y0) / (y1 - y0) * (x1 - x0)
        const distToCenter = Math.abs(beamAtRingX - cx)
        const flareR = 20 * lineScl
        if (distToCenter < ringRadiusLocal + 10 * lineScl && distToCenter > ringRadiusLocal - 30 * lineScl) {
          const flareGrad = ctx.createRadialGradient(
            beamAtRingX, ringY, 0,
            beamAtRingX, ringY, flareR,
          )
          flareGrad.addColorStop(0, `rgba(255,255,255,${opacity * 0.9})`)
          flareGrad.addColorStop(0.4, `rgba(255,255,255,${opacity * 0.3})`)
          flareGrad.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.globalAlpha = 1
          ctx.fillStyle = flareGrad
          ctx.beginPath()
          ctx.arc(beamAtRingX, ringY, flareR, 0, TWO_PI)
          ctx.fill()
        }
      }

      ctx.restore()
    }

    function drawVHSNoise(ctx: CanvasRenderingContext2D, W: number, H: number) {
      const startY = H * 0.88
      ctx.save()

      for (let i = 0; i < 4; i++) {
        const y = startY + i * ((H - startY) / 4) + (Math.random() - 0.5) * 3
        const alpha = 0.05 + Math.random() * 0.15
        ctx.fillStyle = `rgba(255,255,255,${alpha})`
        ctx.fillRect(0, y, W, 1)
      }

      const noiseY = startY + Math.random() * (H - startY) * 0.3
      ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.2})`
      ctx.fillRect(0, noiseY, W, 1)

      for (let x = 0; x < W; x += 2) {
        if (Math.random() > 0.7) {
          const alpha = Math.random() * 0.15
          ctx.fillStyle = `rgba(255,255,255,${alpha})`
          ctx.fillRect(x, startY + Math.random() * (H - startY), 2, 1)
        }
      }

      ctx.restore()
    }

    function drawScanLines(ctx: CanvasRenderingContext2D, W: number, H: number) {
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      for (let y = 0; y < H; y += 3) {
        ctx.fillRect(0, y, W, 1)
      }
      ctx.restore()
    }

    function triggerGlitch(H: number, lineScl: number) {
      const sliceCount = 3 + Math.floor(Math.random() * 3)
      const slices: GlitchSlice[] = []
      const maxDx = Math.max(1, Math.round(21 * lineScl))
      const maxH = Math.max(3, Math.round(11 * lineScl))
      for (let i = 0; i < sliceCount; i++) {
        slices.push({
          y: Math.floor(Math.random() * H),
          h: Math.round(5 * lineScl) + Math.floor(Math.random() * maxH),
          dx: (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * maxDx),
          frames: 2 + Math.floor(Math.random() * 2),
        })
      }
      glitchRef.current = slices
    }

    function applyGlitch(ctx: CanvasRenderingContext2D, W: number) {
      const slices = glitchRef.current
      if (slices.length === 0) return

      for (let i = slices.length - 1; i >= 0; i--) {
        const s = slices[i]
        const imgData = ctx.getImageData(0, s.y, W, s.h)
        ctx.putImageData(imgData, s.dx, s.y)
        s.frames--
        if (s.frames <= 0) slices.splice(i, 1)
      }
    }

    function drawGrain(ctx: CanvasRenderingContext2D, W: number, H: number, energy: number) {
      ctx.save()
      const count = 400 + Math.floor(energy * 600)
      ctx.fillStyle = 'rgba(255,255,255,0.03)'
      for (let i = 0; i < count; i++) {
        const x = Math.random() * W
        const y = Math.random() * H
        ctx.fillRect(x, y, 1, 1)
      }
      ctx.restore()
    }

    function drawColorBleed(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, lineScl: number) {
      ctx.save()
      ctx.globalAlpha = 0.08
      const off = Math.max(1, 2 * lineScl)
      ctx.drawImage(canvas, off, 0)
      ctx.drawImage(canvas, -off, 0)
      ctx.globalAlpha = 1.0
      ctx.restore()
    }

    function drawParticles(
      ctx: CanvasRenderingContext2D,
      W: number, H: number,
      energy: number,
    ) {
      const particles = particlesRef.current
      ctx.save()

      for (const p of particles) {
        const energyBoost = 1 + energy * 4
        p.x += p.vx * energyBoost
        p.y += p.vy * energyBoost

        if (p.x < 0) p.x = W
        if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H
        if (p.y > H) p.y = 0

        ctx.globalAlpha = p.opacity
        ctx.fillStyle = '#00ff44'
        ctx.beginPath()
}}}}
)
