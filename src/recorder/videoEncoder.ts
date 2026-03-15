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
}}
)
