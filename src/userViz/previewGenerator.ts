import type { ComponentType } from 'react'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { UserVizProps } from './types'

const PREVIEW_W = 800
const PREVIEW_H = 450

const WARMUP_FRAMES = 45
const WARMUP_MS = 1000

const PEAK_FRAMES = 20
const PEAK_MS = 300

function buildNeutralSpectrum(): Float32Array {
  const data = new Float32Array(1024)
  for (let i = 0; i < 1024; i++) {
    data[i] = Math.exp(-i * 0.01) * 0.7
  }
  return data
}

function buildPeakSpectrum(): Float32Array {
  const data = new Float32Array(1024)
  for (let i = 0; i < 1024; i++) {
    data[i] = Math.min(1, Math.exp(-i * 0.01) * 1.4)
  }
  return data
}

function findCanvas(root: HTMLElement): HTMLCanvasElement | null {
  return root.querySelector('canvas')
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85)
    } catch {
      resolve(null)
    }
  })
}

function waitForFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let frames = 0
    const tick = () => {
      frames++
      if (frames >= count) resolve()
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

function waitForTime(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function generateUserVizPreview(
  Component: ComponentType<UserVizProps>,
  vizId = 'user-viz',
): Promise<Blob | null> {
  const container = document.createElement('div')
  container.style.cssText =
    'position:fixed;left:0;top:0;width:' +
    PREVIEW_W +
    'px;height:' +
    PREVIEW_H +
    'px;opacity:0;pointer-events:none;z-index:-1;overflow:hidden;'
  document.body.appendChild(container)

  const neutralAudio = buildNeutralSpectrum()
  const peakAudio = buildPeakSpectrum()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    root = createRoot(container)
    root.render(
      createElement(Component, {
        audioData: neutralAudio,
        beat: false,
        energy: 0.04,
        currentTime: 0,
      }),
    )

    await Promise.all([waitForFrames(WARMUP_FRAMES), waitForTime(WARMUP_MS)])

    root.render(
      createElement(Component, {
        audioData: peakAudio,
        beat: true,
        energy: 0.14,
        currentTime: 0,
      }),
    )

    await Promise.all([waitForFrames(PEAK_FRAMES), waitForTime(PEAK_MS)])

    const canvas = findCanvas(container)
    if (!canvas) {
      return null
    }

    if (canvas.width === 0) canvas.width = PREVIEW_W
    if (canvas.height === 0) canvas.height = PREVIEW_H

    const blob = await canvasToJpegBlob(canvas)

    if (!blob || blob.size < 200) return null
    return blob
  } catch (err) {
    console.warn('[preview-gen]', vizId, 'failed:', err)
    return null
  } finally {
    if (root) {
      try {
        root.unmount()
      } catch {}
    }
    try {
      container.remove()
    } catch {}
  }
}
