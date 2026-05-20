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

      // shadowBlur вне цикла
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
        ctx.arc(p.x, p.y, p.size, 0, TWO_PI)
        ctx.fill()
      }

      ctx.restore()
    }

    function drawShockwaves(ctx: CanvasRenderingContext2D) {
      const waves = shockwaveRef.current
      ctx.save()
      ctx.globalCompositeOperation = 'screen'

      for (let i = waves.length - 1; i >= 0; i--) {
        const sw = waves[i]
        const t = 1 - sw.life / sw.maxLife
        const expand = 1 + t * 1.8
        const alpha = (1 - t) * 0.35

        for (const p of sw.puffs) {
          const px = sw.x + p.ax * expand
          const py = sw.y + p.ay * expand
          const pr = p.ar * expand
          const grad = ctx.createRadialGradient(px, py, 0, px, py, pr)
          grad.addColorStop(0, `rgba(255,255,255,${alpha * 0.6})`)
          grad.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.2})`)
          grad.addColorStop(1, `rgba(255,255,255,0)`)
          ctx.fillStyle = grad
          ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2)
        }

        sw.life--
        if (sw.life <= 0) waves.splice(i, 1)
      }

      ctx.restore()
    }

    function drawVignette(ctx: CanvasRenderingContext2D, W: number, H: number) {
      const cx = W / 2
      const cy = H / 2
      const r = Math.max(W, H) * 0.7
      const grad = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r)
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, 'rgba(0,0,0,0.7)')
      ctx.save()
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)
      ctx.restore()
    }

    function draw() {
      if (!canvas || !ctx) return
      const W = canvas.width
      const H = canvas.height
      const cx = W / 2
      const cy = H / 2
      const minDim = Math.min(W, H)
      const scl = minDim / 1080
      const shakeScl = minDim / 900
      const pp = paramsRef.current
      const ringRadius = RING_RADIUS * scl * pp.ringSize

      const { audioData, beat, isPlaying, energy, trackInfo, currentTime } =
        useAudioStore.getState()

      ctx.fillStyle = `rgba(0,0,0,${pp.trailFade})`
      ctx.fillRect(0, 0, W, H)

      if (isPlaying) {
        progressRef.current += (0.004 + energy * 0.02) * pp.scanSpeed
        if (progressRef.current >= TWO_PI) progressRef.current = 0
      }

      if (isPlaying && beat) {
        triggerGlitch(H, scl)
        ringPulseRef.current = 40 * scl
        progressRef.current += 0.15
        if (progressRef.current >= TWO_PI) progressRef.current = 0
        shakeStateRef.current.trauma = Math.min(1, shakeStateRef.current.trauma + 0.6)
        if (energy > 0.08) {
          shakeStateRef.current.trauma = Math.min(1, shakeStateRef.current.trauma + 0.8)
        }
        // ударная волна на бите
        if (energy > 0.06 && shockwaveRef.current.length < 2) {
          const ang = progressRef.current
          shockwaveRef.current.push({
            x: cx + Math.cos(ang) * ringRadius,
            y: cy + Math.sin(ang) * ringRadius,
            life: 25,
            maxLife: 25,
            puffs: Array.from({ length: 5 }, () => ({
              ax: (Math.random() - 0.5) * 30 * scl,
              ay: (Math.random() - 0.5) * 30 * scl,
              ar: (8 + Math.random() * 12) * scl,
            })),
          })
        }
      }

      {
        const s = shakeStateRef.current
        s.trauma *= 0.92
        const shake = s.trauma * s.trauma
        const t = performance.now() * 0.015
        const targetX = (Math.sin(t * 2.1) + Math.sin(t * 3.7)) * 0.5 * shake * 12 * shakeScl
        const targetY = (Math.sin(t * 1.9) + Math.sin(t * 3.3)) * 0.5 * shake * 10 * shakeScl
        const targetRot = Math.sin(t * 2.5) * shake * 0.015
        const stiffness = 0.25
        const damping = 0.6
        s.vx += (targetX - s.x) * stiffness
        s.vy += (targetY - s.y) * stiffness
        s.vr += (targetRot - s.rot) * stiffness
        s.vx *= damping
        s.vy *= damping
        s.vr *= damping
        s.x += s.vx
        s.y += s.vy
        s.rot += s.vr
      }

      if (ringPulseRef.current > 0) {
        ringPulseRef.current *= 0.85
        if (ringPulseRef.current < 0.5) ringPulseRef.current = 0
      }

      const energyAlpha = 0.6 + Math.min(1, energy * 8) * 0.4
      const finalAlpha = energyAlpha

      const bass = audioData.slice(0, 14).reduce((s, v) => s + Math.abs(v), 0) / 14
      const mid = audioData.slice(14, 232).reduce((s, v) => s + Math.abs(v), 0) / 218
      const high = audioData.slice(232, 464).reduce((s, v) => s + Math.abs(v), 0) / 232
      const tr = Math.min(255, Math.round(high * 1500))
      const tg = Math.min(255, Math.round(80 + bass * 1000))
      const tb = Math.min(255, Math.round(mid * 1200))
      ringColorRGB.r += (tr - ringColorRGB.r) * 0.08
      ringColorRGB.g += (tg - ringColorRGB.g) * 0.08
      ringColorRGB.b += (tb - ringColorRGB.b) * 0.08
      currentRingColorRef.current = `rgb(${Math.round(ringColorRGB.r)},${Math.round(ringColorRGB.g)},${Math.round(ringColorRGB.b)})`

      const pulseRadius = ringRadius + ringPulseRef.current

      timeRef.current++
      const driftT = timeRef.current
      const drift = cameraDriftRef.current
      const driftTargetX = isPlaying ? (Math.sin(driftT * 0.013) * 25 + Math.sin(driftT * 0.031) * 10) * shakeScl : 0
      const driftTargetY = isPlaying ? (Math.cos(driftT * 0.011) * 18 + Math.sin(driftT * 0.027) * 7) * shakeScl : 0
      const driftTargetRot = isPlaying ? Math.sin(driftT * 0.008) * 0.015 : 0
      const driftTargetScale = isPlaying ? 1.0 + Math.sin(driftT * 0.018) * 0.04 + energy * 0.08 : 1.0
      drift.x += (driftTargetX - drift.x) * 0.08
      drift.y += (driftTargetY - drift.y) * 0.08
      drift.rot += (driftTargetRot - drift.rot) * 0.08
      drift.scale += (driftTargetScale - drift.scale) * 0.08

      velXRef.current = shakeStateRef.current.x - prevShakeXRef.current
      velYRef.current = shakeStateRef.current.y - prevShakeYRef.current
      prevShakeXRef.current = shakeStateRef.current.x
      prevShakeYRef.current = shakeStateRef.current.y

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(drift.rot)
      ctx.scale(drift.scale, drift.scale)
      ctx.translate(-cx + drift.x, -cy + drift.y)
      ctx.translate(shakeStateRef.current.x, shakeStateRef.current.y)
      ctx.rotate(shakeStateRef.current.rot)

      drawParticles(ctx, W, H, energy)

      if (isPlaying) {
        updateAndDrawLasers(ctx, W, H, cx, cy, beat, energy, scl, ringRadius, Math.floor(pp.beamMax))
      }

      drawShockwaves(ctx)

      // motion blur в два прохода
      const velMag = Math.abs(velXRef.current) + Math.abs(velYRef.current)

      const renderRingPass = (mainPass: boolean) => {
        const ringColor = currentRingColorRef.current

        drawRing(
          ctx, cx, cy, audioData, ringColor,
          pulseRadius, finalAlpha, energy, progressRef.current, 2 * scl, 0.1, 15 * scl * pp.glow,
        )

        drawRing(
          ctx, cx, cy, audioData, null,
          pulseRadius, finalAlpha, energy, progressRef.current,
        )

        if (mainPass) {
          for (let i = 0; i < CORONA_SCALES.length; i++) {
            const coronaRadius = pulseRadius * CORONA_SCALES[i]
            drawRing(
              ctx, cx, cy, audioData, ringColor,
              coronaRadius, finalAlpha, energy, progressRef.current, 2 * scl, CORONA_OPACITIES[i], CORONA_BLURS[i] * scl * pp.glow,
            )
          }
        }
      }

      if (velMag < 0.5) {
        renderRingPass(true)
      } else {
        ctx.save()
        ctx.globalAlpha = 0.3
        ctx.translate(-velXRef.current * 2, -velYRef.current * 2)
        renderRingPass(false)
        ctx.restore()

        renderRingPass(true)
      }

      ctx.globalAlpha = 1.0

      drawVHSNoise(ctx, W, H)

      drawColorBleed(ctx, canvas, scl)

      drawScanLines(ctx, W, H)

      drawGrain(ctx, W, H, energy)

      applyGlitch(ctx, W)

      drawVignette(ctx, W, H)

      ctx.restore()

      ctx.save()
      const titlePx = Math.round(minDim * 0.02)
      ctx.font = `${titlePx}px 'VCR OSD Mono', monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const artist = (trackInfo.artist || '').toUpperCase()
      const title = (trackInfo.title || '').toUpperCase()
      const timer = formatTime(currentTime)

      let fullLine: string
      if (artist && title) fullLine = `${artist} - ${title}   ${timer}`
      else if (title) fullLine = `${title}   ${timer}`
      else if (artist) fullLine = `${artist}   ${timer}`
      else fullLine = timer

      const jitterX = Math.random() < 0.05 ? (Math.random() - 0.5) * 3 : 0
      const jitterY = Math.random() < 0.05 ? (Math.random() - 0.5) * 2 : 0

      const tx = W / 2 + jitterX
      const ty = H * 0.92 + jitterY
      const chOff = Math.max(1, 2 * scl)

      ctx.globalCompositeOperation = 'screen'
      ctx.fillStyle = 'rgba(255,0,0,0.7)'
      ctx.fillText(fullLine, tx - chOff, ty)
      ctx.fillStyle = 'rgba(0,0,255,0.7)'
      ctx.fillText(fullLine, tx + chOff, ty)
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.fillText(fullLine, tx, ty)

      ctx.restore()

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'block',
        zIndex: 0,
      }}
    />
  )
}
