import { invoke } from '@tauri-apps/api/core'
import { writeFile } from '@tauri-apps/plugin-fs'

export async function beginFrameStream(width: number, height: number, fps: number): Promise<string> {
  return invoke<string>('begin_frame_stream', { width, height, fps })
}

export async function appendFrame(framePath: string, frameBytes: Uint8Array): Promise<void> {
  await writeFile(framePath, frameBytes, { append: true })
}

export async function cancelFrameStream(framePath: string): Promise<void> {
  await invoke('cancel_frame_stream', { frameFilePath: framePath })
}

export async function finalizeVideo(
  framePath: string,
  captureWidth: number,
  captureHeight: number,
  outputWidth: number,
  outputHeight: number,
  fps: number,
  audioBytes: Uint8Array,
  audioExtension: string,
  outputPath: string,
): Promise<void> {
  await invoke('finalize_video', {
    frameFilePath: framePath,
    captureWidth,
    captureHeight,
    outputWidth,
    outputHeight,
    fps,
    audioBytes,
    audioExtension,
    outputPath,
  })
}

export class FrameCapture {
  private readonly tempCanvas: HTMLCanvasElement
  private readonly tempCtx: CanvasRenderingContext2D

  constructor(public readonly width: number, public readonly height: number) {
    this.tempCanvas = document.createElement('canvas')
    this.tempCanvas.width = width
    this.tempCanvas.height = height
    const ctx = this.tempCanvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('не удалось создать 2d контекст для захвата кадров')
    this.tempCtx = ctx
  }

  grab(source: HTMLCanvasElement): Uint8Array {
    this.tempCtx.drawImage(source, 0, 0, this.width, this.height)
    const id = this.tempCtx.getImageData(0, 0, this.width, this.height)
    return new Uint8Array(id.data.buffer)
  }
}
