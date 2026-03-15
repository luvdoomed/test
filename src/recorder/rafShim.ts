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
  if (!state.installed) return
  state.installed = false

  if (state.originalRaf) window.requestAnimationFrame = state.originalRaf
  if (state.originalCaf) window.cancelAnimationFrame = state.originalCaf
  if (state.originalNow) performance.now = state.originalNow

  state.originalRaf = null
  state.originalCaf = null
  state.originalNow = null
  state.queue.clear()
}

export async function tickFrame(deltaMs: number): Promise<void> {
  state.virtualNow += deltaMs

  // коммит рефов визуализаторов после изменения стора до выстрела rAF
  flushSync(() => {})

  // снимок очереди: повторная регистрация колбэков падает в следующий тик
  const pending = Array.from(state.queue.values())
  state.queue.clear()

  for (const cb of pending) {
    try {
      cb(state.virtualNow)
    } catch (err) {
      console.error('[rafShim] ошибка в rAF колбэке:', err)
    }
  }

  // микротаска даёт three/react время довести побочные эффекты
  await Promise.resolve()
}

export function _internalState() {
  return {
    installed: state.installed,
    virtualNow: state.virtualNow,
    queueSize: state.queue.size,
  }
}
