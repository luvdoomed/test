import { invoke } from '@tauri-apps/api/core'
import { writeFile } from '@tauri-apps/plugin-fs'
import { flushSync } from 'react-dom'
import { analyzeOffline } from '../audio/offlineAnalyzer'
import { audioEngine } from '../audio/audioEngine'
import { useAudioStore } from '../store/audioStore'

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

const WRITE_CONCURRENCY = 3

const shim = {
  installed: false,
  virtualNow: 0,
  nextId: 1,
  queue: new Map<number, FrameRequestCallback>(),
  origRaf: null as typeof window.requestAnimationFrame | null,
  origCaf: null as typeof window.cancelAnimationFrame | null,
  origNow: null as typeof performance.now | null,
}

function installShim(): void {
  if (shim.installed) return
  shim.installed = true
  shim.virtualNow = 0
  shim.nextId = 1
  shim.queue.clear()
  shim.origRaf = window.requestAnimationFrame
  shim.origCaf = window.cancelAnimationFrame
  shim.origNow = performance.now
  window.requestAnimationFrame = (cb) => {
    const id = shim.nextId++
    shim.queue.set(id, cb)
    return id
  }
  window.cancelAnimationFrame = (id) => { shim.queue.delete(id) }
  performance.now = () => shim.virtualNow
}

function uninstallShim(): void {
  if (!shim.installed) return
  shim.installed = false

  // pending колбэки не дропаем
  const pending = Array.from(shim.queue.values())
  shim.queue.clear()

  if (shim.origRaf) window.requestAnimationFrame = shim.origRaf
  if (shim.origCaf) window.cancelAnimationFrame = shim.origCaf
  if (shim.origNow) performance.now = shim.origNow

  for (const cb of pending) {
    try { window.requestAnimationFrame(cb) } catch {}
  }

  shim.origRaf = shim.origCaf = shim.origNow = null
}

async function tickFrame(deltaMs: number): Promise<void> {
  shim.virtualNow += deltaMs
  flushSync(() => {})

  const pending = Array.from(shim.queue.values())
  shim.queue.clear()

  for (const cb of pending) {
    try { cb(shim.virtualNow) } catch (err) { console.error('[rec] rAF cb error:', err) }
  }

  // виртуальное время для r3f
  window.dispatchEvent(new CustomEvent('mvapp-export-tick', { detail: shim.virtualNow / 1000 }))

  // три ротации r3f
  for (let i = 0; i < 3; i++) {
    await Promise.resolve()
  }

  flushSync(() => {})
}

function findMainCanvas(): HTMLCanvasElement | null {
  const canvases = Array.from(document.querySelectorAll('canvas'))
  if (canvases.length === 0) return null
  // выбираем по css-площади
  let best: HTMLCanvasElement | null = null
  let bestArea = -1
  for (const c of canvases) {
    const rect = c.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) continue
    const area = rect.width * rect.height
    if (area > bestArea) { bestArea = area; best = c }
  }
  return best
}

// центрируем и обрезаем
function drawCover(
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  dstW: number,
  dstH: number,
): void {
  const sw = src.width
  const sh = src.height
  if (sw === 0 || sh === 0) return
  const srcRatio = sw / sh
  const dstRatio = dstW / dstH
  let sx = 0, sy = 0, sWidth = sw, sHeight = sh
  if (srcRatio > dstRatio) {
    sHeight = sh
    sWidth = sh * dstRatio
    sx = (sw - sWidth) / 2
  } else if (srcRatio < dstRatio) {
    sWidth = sw
    sHeight = sw / dstRatio
    sy = (sh - sHeight) / 2
  }
  ctx.drawImage(src, sx, sy, sWidth, sHeight, 0, 0, dstW, dstH)
}

function pad7(n: number): string {
  return String('0000000' + n).slice(-7)
}

function canvasToJpegBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('canvas.toBlob вернул null')); return }
      const fr = new FileReader()
      fr.onload = () => resolve(new Uint8Array(fr.result as ArrayBuffer))
      fr.onerror = () => reject(fr.error ?? new Error('FileReader error'))
      fr.readAsArrayBuffer(blob)
    }, 'image/jpeg', 0.85)
  })
}

export async function runRecording(options: RecordOptions): Promise<RecordResult> {
  const { audioBuffer, fps, width, height, audioBytes, audioExtension, outputPath, onProgress } = options

  const analysis = await analyzeOffline(audioBuffer, fps)
  const store = useAudioStore.getState()

  const startCanvas = findMainCanvas()
  if (!startCanvas) throw new Error('canvas визуализатора не найден в DOM')

  audioEngine.stop()

  // промежуточный canvas в целевом разрешении
  const scaledCanvas = document.createElement('canvas')
  scaledCanvas.width = width
  scaledCanvas.height = height
  const scaledCtx = scaledCanvas.getContext('2d')
  if (!scaledCtx) throw new Error('не удалось создать scaled 2d контекст')

  const total = analysis.totalFrames
  const deltaMs = 1000 / fps

  // кадры пишем на диск
  const framesDir = await invoke<string>('prepare_export_dir')

  let writtenFrames = 0
  let totalBytes = 0
  const inFlight = new Set<Promise<void>>()

  async function enqueueWrite(name: string, bytes: Uint8Array): Promise<void> {
    while (inFlight.size >= WRITE_CONCURRENCY) {
      await Promise.race(inFlight)
    }
    const p = writeFile(`${framesDir}/${name}`, bytes)
      .catch((err) => { console.error('[rec] writeFile error', name, err); throw err })
      .finally(() => { inFlight.delete(p) })
    inFlight.add(p)
  }

  // останавливаем r3f до старта shim'а
  window.dispatchEvent(new Event('mvapp-export-start'))
  await Promise.resolve()

  installShim()
  let exportFailed = false
  try {
    for (let f = 0; f < total; f++) {
      store.setAudioData(analysis.snapshots[f])
      store.setEnergy(analysis.energies[f])
      store.setBeat(analysis.beats[f])
      store.setCurrentTime(f / fps)
      store.setIsPlaying(true)

      await tickFrame(deltaMs)

      const canvas = findMainCanvas()
      if (!canvas) throw new Error('canvas визуализатора пропал из DOM')

      drawCover(scaledCtx, canvas, scaledCanvas.width, scaledCanvas.height)
      const jpeg = await canvasToJpegBytes(scaledCanvas)
      totalBytes += jpeg.byteLength

      await enqueueWrite(`frame_${pad7(writtenFrames)}.jpg`, jpeg)
      writtenFrames++

      if (onProgress && f % 30 === 0) onProgress(f, total)
    }

    // ждём оставшиеся записи на диск
    if (inFlight.size > 0) await Promise.all(Array.from(inFlight))

    store.setIsPlaying(false)
    if (onProgress) onProgress(total, total)
  } catch (err) {
    exportFailed = true
    throw err
  } finally {
    uninstallShim()
    window.dispatchEvent(new Event('mvapp-export-end'))
    if (exportFailed) {
      try { await invoke('cleanup_export_dir', { dir: framesDir }) } catch {}
    }
  }

  await invoke('build_video_from_dir', {
    framesDir,
    width,
    height,
    fps,
    audioBytes: Array.from(audioBytes),
    audioExtension,
    outputPath,
  })

  return { frameCount: writtenFrames, width, height, fps }
}
