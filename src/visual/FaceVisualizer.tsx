import { useEffect, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'
import { useVisualizerParams } from '../presets/useVisualizerParams'
import faceUrl from '../assets/face.jpg'

const TWO_PI = Math.PI * 2
const GRID_W = 110
const GRID_H = 140
const BRIGHTNESS_THRESHOLD = 0.12

interface FaceParams {
    faceSize: number
    dotSize: number
    chromaShift: number
    beatZoom: number
    rayLength: number
}

interface Dot {
    gx: number
    gy: number
    brightness: number
    phase: number
}

interface Ray {
    angle: number
    life: number
    maxLife: number
    length: number
}

export function FaceVisualizer() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const rafRef = useRef(0)

    const params = useVisualizerParams<FaceParams>('face')
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

        let dots: Dot[] = []

        const img = new Image()
        img.src = faceUrl
        img.onload = () => {
            const off = document.createElement('canvas')
            off.width = GRID_W
            off.height = GRID_H
            const offCtx = off.getContext('2d')
            if (!offCtx) return

            const imgRatio = img.width / img.height
            let dw = GRID_W
            let dh = GRID_H
            let dx = 0
            let dy = 0
            if (imgRatio > GRID_W / GRID_H) {
                dh = GRID_W / imgRatio
                dy = (GRID_H - dh) / 2
            } else {
                dw = GRID_H * imgRatio
                dx = (GRID_W - dw) / 2
            }
            offCtx.fillStyle = '#000'
            offCtx.fillRect(0, 0, GRID_W, GRID_H)
            offCtx.drawImage(img, dx, dy, dw, dh)

            const imageData = offCtx.getImageData(0, 0, GRID_W, GRID_H)
            const pixels = imageData.data
            const newDots: Dot[] = []
            for (let gy = 0; gy < GRID_H; gy++) {
                for (let gx = 0; gx < GRID_W; gx++) {
                    const idx = (gy * GRID_W + gx) * 4
                    const r = pixels[idx]
                    const g = pixels[idx + 1]
                    const b = pixels[idx + 2]
                    const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255
                    if (lum > BRIGHTNESS_THRESHOLD) {
                        newDots.push({
                            gx,
                            gy,
                            brightness: lum,
                            phase: (gx * 0.17 + gy * 0.23) % TWO_PI,
                        })
                    }
                }
            }
            dots = newDots
        }
        img.onerror = () => console.warn('face image failed')

        const shake = { x: 0, y: 0, vx: 0, vy: 0, trauma: 0 }
        let kickX = 0
        let kickY = 0
        let prevShakeX = 0
        let prevShakeY = 0

        const drift = { x: 0, y: 0 }
        let timeFrame = 0

        let beatPulse = 0
        let prevBeat = false

        const rays: Ray[] = []

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
            const data = audioDataRef.current
            const curBeat = beatRef.current
            const curEnergy = energyRef.current
            const curIsPlaying = isPlayingRef.current

            timeFrame++

            const pp = paramsRef.current
            const faceSizeMul = Math.max(0, pp.faceSize)
            const dotSizeMul = Math.max(0, pp.dotSize)
            const chromaMul = Math.max(0, pp.chromaShift)
            const beatZoomMul = Math.max(0, pp.beatZoom)
            const rayLenMul = Math.max(0, pp.rayLength)

            ctx.fillStyle = 'rgba(4,1,10,0.45)'
            ctx.fillRect(0, 0, W, H)

            let bass = 0, mid = 0, high = 0
            for (let i = 0; i < 14; i++) bass += Math.abs(data[i] ?? 0)
            for (let i = 30; i < 60; i++) mid += Math.abs(data[i] ?? 0)
            for (let i = 80; i < 120; i++) high += Math.abs(data[i] ?? 0)
            bass /= 14; mid /= 30; high /= 40

            const beatHit = curBeat && !prevBeat && curIsPlaying
            prevBeat = curBeat
            const sizeScale = Math.min(W, H) / 900
            const lineScale = Math.min(W, H) / 1080
            const chromaScale = Math.min(W, H) / 1080

            if (beatHit) {
                shake.trauma = Math.min(1, shake.trauma + (curEnergy > 0.05 ? 1.6 : 1.0))
                const ang = Math.random() * TWO_PI
                const kp = (curEnergy > 0.05 ? 28 : 16) * sizeScale
                kickX = Math.cos(ang) * kp
                kickY = Math.sin(ang) * kp
                beatPulse = 1.0

                if (curEnergy > 0.05) {
                    const rayCount = 5 + Math.floor(Math.random() * 4)
                    for (let i = 0; i < rayCount; i++) {
                        rays.push({
                            angle: Math.random() * TWO_PI,
                            life: 18,
                            maxLife: 18,
                            length: (200 + Math.random() * 250) * sizeScale * rayLenMul,
                        })
                    }
                }
            }
            beatPulse *= 0.88
            kickX *= 0.7
            kickY *= 0.7

            shake.trauma *= 0.88
            const tPow = shake.trauma * shake.trauma
            const pt = performance.now() * 0.015
            const tX = (Math.sin(pt * 2.1) + Math.sin(pt * 3.7)) * 0.5 * tPow * 25 * sizeScale
            const tY = (Math.sin(pt * 1.9) + Math.sin(pt * 3.3)) * 0.5 * tPow * 18 * sizeScale
            shake.vx += (tX - shake.x) * 0.4; shake.vx *= 0.55; shake.x += shake.vx
            shake.vy += (tY - shake.y) * 0.4; shake.vy *= 0.55; shake.y += shake.vy

            const velX = shake.x - prevShakeX + kickX
            const velY = shake.y - prevShakeY + kickY
}}}
)
