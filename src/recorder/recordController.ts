import { analyzeOffline } from '../audio/offlineAnalyzer'
import { audioEngine } from '../audio/audioEngine'
import { useAudioStore } from '../store/audioStore'
import { installShim, tickFrame, uninstallShim } from './rafShim'
import {
  FrameCapture,
  beginFrameStream,
  appendFrame,
  cancelFrameStream,
  finalizeVideo,
} from './videoEncoder'

export interface RecordOptions {
  audioBuffer: AudioBuffer
  fps: number
  width: number
  height: number
  audioBytes: Uint8Array
  audioExtension: string
  outputPath: string
  onProgress?: (frameIdx: number, total: number) => void
}

export interface RecordResult {
  frameCount: number
  width: number
  height: number
  fps: number
}

function findMainCanvas(): HTMLCanvasElement | null {
  const canvases = Array.from(document.querySelectorAll('canvas'))
  if (canvases.length === 0) return null
  canvases.sort((a, b) => (b.width * b.height) - (a.width * a.height))
  return canvases[0]
}

function detectGL(canvas: HTMLCanvasElement): WebGL2RenderingContext | WebGLRenderingContext | null {
  try {
    const gl2 = canvas.getContext('webgl2') as WebGL2RenderingContext | null
    if (gl2) return gl2
  } catch { /* ignore */ }
  try {
    const gl = canvas.getContext('webgl') as WebGLRenderingContext | null
    if (gl) return gl
  } catch { /* ignore */ }
  return null
}

function flipRowsInPlace(dst: Uint8Array, width: number, height: number): void {
  const rowBytes = width * 4
  const tmp = new Uint8Array(rowBytes)
  const half = height >> 1
  for (let y = 0; y < half; y++) {
    const top = y * rowBytes
    const bot = (height - 1 - y) * rowBytes
    tmp.set(dst.subarray(top, top + rowBytes))
    dst.copyWithin(top, bot, bot + rowBytes)
    dst.set(tmp, bot)
  }
}

export async function runRecording(options: RecordOptions): Promise<RecordResult> {
  const { audioBuffer, fps, width, height, audioBytes, audioExtension, outputPath, onProgress } = options

  const analysis = await analyzeOffline(audioBuffer, fps)
  const store = useAudioStore.getState()

  const allCanvases = Array.from(document.querySelectorAll('canvas'))
  const canvasSizes = allCanvases.map(c => ({ w: c.width, h: c.height }))
  const startCanvas = findMainCanvas()
  if (!startCanvas) throw new Error('canvas визуализатора не найден в DOM')

  // захват идёт в нативных пикселях canvas, а не в целевых, чтобы не плющить аспект
  const captureWidth = startCanvas.width
  const captureHeight = startCanvas.height

  const capture = new FrameCapture(captureWidth, captureHeight)

  console.log('[rec-diag] START', {
    outputW: width,
    outputH: height,
    captureW: captureWidth,
    captureH: captureHeight,
    canvasW: startCanvas.width,
    canvasH: startCanvas.height,
    canvasStyleW: startCanvas.style.width,
}}
)
