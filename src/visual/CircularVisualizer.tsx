import { useEffect, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'
import { useVisualizerParams } from '../presets/useVisualizerParams'

const POINTS = 128
const TWO_PI = Math.PI * 2

interface CircularParams {
  ringSize: number
  displace: number
  rotationSpeed: number
  sparkRate: number
  glow: number
}

const RING_CONFIGS = [
  { base: 70, displace: 40, lineW: 3, rotSpeed: 0.004, band: 'bass' as const },
  { base: 110, displace: 75, lineW: 2, rotSpeed: -0.003, band: 'mid' as const },
  { base: 150, displace: 55, lineW: 1.5, rotSpeed: 0.006, band: 'high' as const },
]

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  life: number
  maxLife: number
}

export function CircularVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)

  const params = useVisualizerParams<CircularParams>('circular')
  const paramsRef = useRef(params)
  paramsRef.current = params

  const beat = useAudioStore((s) => s.beat)
  const audioData = useAudioStore((s) => s.audioData)
  const energy = useAudioStore((s) => s.energy)
  const isPlaying = useAudioStore((s) => s.isPlaying)
  const trackInfo = useAudioStore((s) => s.trackInfo)

  const beatRef = useRef(beat)
  const audioDataRef = useRef(audioData)
  const energyRef = useRef(energy)
  const isPlayingRef = useRef(isPlaying)
  const trackInfoRef = useRef(trackInfo)
  beatRef.current = beat
  audioDataRef.current = audioData
  energyRef.current = energy
  isPlayingRef.current = isPlaying
  trackInfoRef.current = trackInfo

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const smoothed = RING_CONFIGS.map(() => new Float32Array(POINTS))
    const rotations = RING_CONFIGS.map(() => 0)

    const sparks: Spark[] = []

    const shake = { x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, trauma: 0 }
    let kickX = 0
    let kickY = 0

    const drift = { x: 0, y: 0, rot: 0 }
    let timeFrame = 0

    let beatScale = 1.0
    let prevBeat = false

    let trackOpacity = 0
    let lastTitle = ''

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    function draw() {
      if (!canvas || !ctx) return

      const W = canvas.width
      const H = canvas.height
      const cx = W / 2
      const cy = H / 2
      const minDim = Math.min(W, H)
      const sizeScale = minDim / 1080
      const shakeScale = minDim / 900
      const data = audioDataRef.current
      const curBeat = beatRef.current
      const curEnergy = energyRef.current
      const curIsPlaying = isPlayingRef.current

      timeFrame++

      const pp = paramsRef.current
      const ringSizeMul = Math.max(0, pp.ringSize)
      const displaceMul = Math.max(0, pp.displace)
      const rotSpeedMul = Math.max(0, pp.rotationSpeed)
      const sparkRateMul = Math.max(0, pp.sparkRate)
      const glowMul = Math.max(0, pp.glow)

      ctx.fillStyle = 'rgba(4,8,6,0.22)'
      ctx.fillRect(0, 0, W, H)

      const beatHit = curBeat && !prevBeat && curIsPlaying
      prevBeat = curBeat
      if (beatHit) {
        shake.trauma = Math.min(1, shake.trauma + (curEnergy > 0.05 ? 1.2 : 0.7))
        const kickAngle = Math.random() * TWO_PI
        const kickPower = (curEnergy > 0.05 ? 18 : 10) * shakeScale
        kickX = Math.cos(kickAngle) * kickPower
        kickY = Math.sin(kickAngle) * kickPower
        beatScale = curEnergy > 0.05 ? 1.08 : 1.04
      }
      beatScale += (1 - beatScale) * 0.12
      kickX *= 0.7
      kickY *= 0.7

      shake.trauma *= 0.88
      const tPow = shake.trauma * shake.trauma
      const pt = performance.now() * 0.015
      const tX = (Math.sin(pt * 2.1) + Math.sin(pt * 3.7)) * 0.5 * tPow * 14 * shakeScale
      const tY = (Math.sin(pt * 1.9) + Math.sin(pt * 3.3)) * 0.5 * tPow * 11 * shakeScale
      const tR = Math.sin(pt * 2.5) * tPow * 0.025
      shake.vx += (tX - shake.x) * 0.4; shake.vx *= 0.55; shake.x += shake.vx
      shake.vy += (tY - shake.y) * 0.4; shake.vy *= 0.55; shake.y += shake.vy
      shake.vr += (tR - shake.rot) * 0.4; shake.vr *= 0.55; shake.rot += shake.vr

      if (curIsPlaying) {
        const tt = timeFrame
        drift.x += (Math.sin(tt * 0.011) * 18 * shakeScale + Math.sin(tt * 0.027) * 7 * shakeScale - drift.x) * 0.06
        drift.y += (Math.cos(tt * 0.009) * 14 * shakeScale + Math.sin(tt * 0.023) * 5 * shakeScale - drift.y) * 0.06
        drift.rot += (Math.sin(tt * 0.007) * 0.015 - drift.rot) * 0.06
      } else {
        drift.x *= 0.92; drift.y *= 0.92; drift.rot *= 0.92
      }

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(drift.rot + shake.rot)
      ctx.scale(beatScale, beatScale)
      ctx.translate(-cx + drift.x + shake.x + kickX, -cy + drift.y + shake.y + kickY)
}}}
)
