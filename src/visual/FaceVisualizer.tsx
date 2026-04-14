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
}}}}}}}
))
