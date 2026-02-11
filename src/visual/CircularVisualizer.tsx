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
}
