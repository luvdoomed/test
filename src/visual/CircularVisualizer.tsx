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
}}}
)
