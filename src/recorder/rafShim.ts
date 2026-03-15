import { flushSync } from 'react-dom'

const state = {
  installed: false,
  virtualNow: 0,
  nextId: 1,
  queue: new Map<number, FrameRequestCallback>(),
  originalRaf: null as typeof window.requestAnimationFrame | null,
  originalCaf: null as typeof window.cancelAnimationFrame | null,
  originalNow: null as typeof performance.now | null,
}

function shimmedRaf(cb: FrameRequestCallback): number {
  const id = state.nextId++
  state.queue.set(id, cb)
  return id
}

function shimmedCaf(id: number): void {
  state.queue.delete(id)
}

function shimmedNow(): number {
  return state.virtualNow
}

export function installShim(): void {
  if (state.installed) return
  state.installed = true
  state.virtualNow = 0
  state.nextId = 1
  state.queue.clear()

  state.originalRaf = window.requestAnimationFrame
  state.originalCaf = window.cancelAnimationFrame
  state.originalNow = performance.now

  window.requestAnimationFrame = shimmedRaf
  window.cancelAnimationFrame = shimmedCaf
  performance.now = shimmedNow
}

export function uninstallShim(): void {
}
