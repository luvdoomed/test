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
            prevShakeX = shake.x
            prevShakeY = shake.y

            if (curIsPlaying) {
                drift.x += (Math.sin(timeFrame * 0.011) * 50 * sizeScale + Math.sin(timeFrame * 0.027) * 18 * sizeScale - drift.x) * 0.05
                drift.y += (Math.cos(timeFrame * 0.009) * 35 * sizeScale + Math.sin(timeFrame * 0.023) * 12 * sizeScale - drift.y) * 0.05
            } else {
                drift.x *= 0.92; drift.y *= 0.92
            }

            const atmOpacity = 0.15 + high * 1.5
            const atmGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.55)
            atmGrad.addColorStop(0, `rgba(60,10,80,${Math.min(0.4, atmOpacity)})`)
            atmGrad.addColorStop(0.6, `rgba(30,5,50,${Math.min(0.2, atmOpacity * 0.5)})`)
            atmGrad.addColorStop(1, 'rgba(0,0,0,0)')
            ctx.fillStyle = atmGrad
            ctx.fillRect(0, 0, W, H)

            for (let i = rays.length - 1; i >= 0; i--) {
                const ray = rays[i]
                const t = 1 - ray.life / ray.maxLife
                const alpha = Math.pow(1 - t, 2) * 0.6
                const len = ray.length * (0.3 + t * 0.7)

                const startX = cx + drift.x + shake.x + kickX
                const startY = cy + drift.y + shake.y + kickY
                const endX = startX + Math.cos(ray.angle) * len
                const endY = startY + Math.sin(ray.angle) * len

                const grad = ctx.createLinearGradient(startX, startY, endX, endY)
                grad.addColorStop(0, `rgba(255,180,240,${alpha * 0.8})`)
                grad.addColorStop(0.5, `rgba(255,100,220,${alpha * 0.4})`)
                grad.addColorStop(1, 'rgba(255,100,220,0)')

                ctx.save()
                ctx.strokeStyle = grad
                ctx.lineWidth = 1.5 + (1 - t) * 2 * lineScale
                ctx.shadowBlur = 20
                ctx.shadowColor = 'rgba(255,100,220,0.8)'
                ctx.beginPath()
                ctx.moveTo(startX, startY)
                ctx.lineTo(endX, endY)
                ctx.stroke()
                ctx.restore()

                ray.life--
                if (ray.life <= 0) rays.splice(i, 1)
            }

            const faceH = Math.min(H * 0.85, W * 1.1) * faceSizeMul
            const faceW = faceH * (GRID_W / GRID_H)
            const beatScale = 1 + beatPulse * 0.12 * beatZoomMul
            const scaledW = faceW * beatScale
            const scaledH = faceH * beatScale
            const scaledOffX = cx - scaledW / 2 + drift.x + shake.x + kickX
            const scaledOffY = cy - scaledH / 2 + drift.y + shake.y + kickY
            const scaledCellW = scaledW / GRID_W
            const scaledCellH = scaledH / GRID_H

            const motionAmount = Math.min(1, Math.abs(velX) + Math.abs(velY))
            const chromaShift = (0.5 + motionAmount * 1.5 + high * 2) * chromaScale * chromaMul

            // motion blur — доп. проход со смещением по velocity
            const motionPasses = motionAmount > 0.25 ? [
                { dx: -velX * 0.25, dy: -velY * 0.25, alphaMul: 0.2 },
            ] : []

            for (const dot of dots) {
                const freqIdx = Math.floor((dot.gx / GRID_W) * 100) + 4
                const freqAmp = Math.abs(data[freqIdx] ?? 0)

                const wave = Math.sin(timeFrame * 0.04 + dot.phase) * 0.5 + 0.5
                const pulse = dot.brightness * (0.5 + wave * 0.5 + freqAmp * 2.5 + beatPulse * 0.3 + high * 1.2)

                const px = scaledOffX + dot.gx * scaledCellW
                const py = scaledOffY + dot.gy * scaledCellH

                const alpha = Math.min(1, pulse * 0.5 + dot.brightness * 0.6)
                const columnHeight = scaledCellH * (0.3 + dot.brightness * 0.6 + pulse * 1.0)
                const dotSize = Math.max(0.7, scaledCellW * (0.35 + dot.brightness * 0.4) * dotSizeMul)
                const dotsInColumn = 1 + Math.floor(pulse * 2)

                const brightShift = (dot.brightness - 0.5) * 2
                const baseR = Math.round(180 + brightShift * 75)
                const baseG = Math.round(80 + brightShift * 100)
                const baseB = Math.round(180 + brightShift * 60)
                const useChroma = chromaShift > 0.8
                const passes = useChroma ? [
                    { dx: -chromaShift, dy: 0, r: Math.max(80, baseR - 30), g: 40, b: Math.max(100, baseB - 40), alphaMul: 0.5 },
                    { dx: 0, dy: 0, r: baseR, g: baseG, b: baseB, alphaMul: 1.0 },
                    { dx: chromaShift, dy: 0, r: Math.max(80, baseR - 60), g: Math.max(80, baseG - 20), b: Math.min(255, baseB + 40), alphaMul: 0.4 },
                ] : [
                    { dx: 0, dy: 0, r: baseR, g: baseG, b: baseB, alphaMul: 1.0 },
                ]

                for (const mp of motionPasses) {
                    ctx.save()
                    ctx.globalAlpha = mp.alphaMul
                    ctx.fillStyle = `rgba(255,130,220,${alpha})`
                    ctx.shadowBlur = 0
                    ctx.shadowColor = 'rgba(255,130,220,0.6)'
                    for (let k = 0; k < dotsInColumn; k++) {
                        const kt = k / Math.max(1, dotsInColumn - 1)
                        const dotY = py + (kt - 0.5) * columnHeight + mp.dy
                        ctx.beginPath()
}}}}}}
)
