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
    canvasStyleH: startCanvas.style.height,
    canvasCssW: startCanvas.getBoundingClientRect().width,
    canvasCssH: startCanvas.getBoundingClientRect().height,
    winInnerW: window.innerWidth,
    winInnerH: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    canvasCount: allCanvases.length,
    canvasSizes,
  })

  audioEngine.stop()

  const realNow = performance.now.bind(performance)

  const framePath = await beginFrameStream(captureWidth, captureHeight, fps)
  let finalized = false
  let writtenFrames = 0

  // пинг-понг из двух буферов: пока один уезжает в ipc, второй принимает следующий кадр
  const frameBytes = captureWidth * captureHeight * 4
  const framePools = [new Uint8Array(frameBytes), new Uint8Array(frameBytes)]
  let poolIdx = 0

  let pendingWrite: Promise<void> | null = null

  let cachedCanvas: HTMLCanvasElement | null = null
  let cachedGL: WebGL2RenderingContext | WebGLRenderingContext | null = null
  let pathLogged = false

  let tickTotal = 0
  let grabTotal = 0
  let writeTotal = 0

  try {
    installShim()
    try {
      const total = analysis.totalFrames
      const deltaMs = 1000 / fps

      for (let f = 0; f < total; f++) {
        store.setAudioData(analysis.snapshots[f])
        store.setEnergy(analysis.energies[f])
        store.setBeat(analysis.beats[f])
        store.setCurrentTime(f / fps)
        store.setIsPlaying(true)

        const tTick0 = realNow()
        await tickFrame(deltaMs)
        tickTotal += realNow() - tTick0

        const canvas = findMainCanvas()
        if (!canvas) throw new Error('canvas визуализатора не найден в DOM')

        if (f % 100 === 0) {
          const rect = canvas.getBoundingClientRect()
          console.log('[rec-diag] frame', f, {
            outputW: width,
            outputH: height,
            captureW: captureWidth,
            captureH: captureHeight,
            canvasW: canvas.width,
            canvasH: canvas.height,
            canvasStyleW: canvas.style.width,
            canvasStyleH: canvas.style.height,
            canvasCssW: rect.width,
            canvasCssH: rect.height,
            canvasTransform: canvas.style.transform,
            winInnerW: window.innerWidth,
            winInnerH: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio,
          })
        }

        if (canvas !== cachedCanvas) {
          cachedCanvas = canvas
          cachedGL = detectGL(canvas)
        }

        const canUseGL = cachedGL !== null && canvas.width === captureWidth && canvas.height === captureHeight

        if (!pathLogged) {
          pathLogged = true
          const isGL2 = typeof WebGL2RenderingContext !== 'undefined'
            && cachedGL instanceof WebGL2RenderingContext
          const contextType = cachedGL === null ? '2d-or-none' : (isGL2 ? 'webgl2' : 'webgl')
          const fallbackReason = cachedGL === null
            ? 'canvas без gl, идём через drawImage+getImageData'
            : (canUseGL ? null : 'размеры canvas изменились после старта, остаёмся на 2d-drawImage')
          console.log('[rec-grab] путь захвата', {
            contextType,
            willFlip: canUseGL,
            fallbackReason,
          })
        }

        const framePool = framePools[poolIdx]

        const tGrab0 = realNow()
        if (canUseGL) {
          const gl = cachedGL as WebGL2RenderingContext | WebGLRenderingContext
          gl.readPixels(0, 0, captureWidth, captureHeight, gl.RGBA, gl.UNSIGNED_BYTE, framePool)
          flipRowsInPlace(framePool, captureWidth, captureHeight)
        } else {
          const bytes = capture.grab(canvas)
          framePool.set(bytes)
        }
        grabTotal += realNow() - tGrab0

        // ждём предыдущую запись уже после захвата, чтобы grab перекрывался с write,
        if (pendingWrite) {
          await pendingWrite
          pendingWrite = null
        }

        const wStart = realNow()
        pendingWrite = appendFrame(framePath, framePool).then(() => {
          writeTotal += realNow() - wStart
        })

        poolIdx = 1 - poolIdx
        writtenFrames++

        if (onProgress && f % 30 === 0) onProgress(f, total)

        if (f > 0 && f % 500 === 0) {
          const n = f + 1
          console.log('[rec-timing] кадр', f, {
            avgTickMs: (tickTotal / n).toFixed(2),
            avgGrabMs: (grabTotal / n).toFixed(2),
            avgWriteMs: (writeTotal / n).toFixed(2),
            avgTotalMs: ((tickTotal + grabTotal + writeTotal) / n).toFixed(2),
          })
        }
      }

      if (pendingWrite) {
        await pendingWrite
        pendingWrite = null
      }

      store.setIsPlaying(false)
      if (onProgress) onProgress(total, total)

      const n = Math.max(1, writtenFrames)
      console.log('[rec-timing] итого', {
        frames: writtenFrames,
        tickMs: Math.round(tickTotal),
        grabMs: Math.round(grabTotal),
        writeMs: Math.round(writeTotal),
        avgTickMs: (tickTotal / n).toFixed(2),
        avgGrabMs: (grabTotal / n).toFixed(2),
        avgWriteMs: (writeTotal / n).toFixed(2),
        avgTotalMs: ((tickTotal + grabTotal + writeTotal) / n).toFixed(2),
      })
    } finally {
      uninstallShim()
    }

    await finalizeVideo(framePath, captureWidth, captureHeight, width, height, fps, audioBytes, audioExtension, outputPath)
    finalized = true
  } finally {
    if (!finalized) {
      if (pendingWrite) {
        try { await pendingWrite } catch { /* ignore */ }
        pendingWrite = null
      }
      try { await cancelFrameStream(framePath) } catch { /* уже убит */ }
    }
  }

  return { frameCount: writtenFrames, width, height, fps }
}
