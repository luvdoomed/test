import { useThree } from '@react-three/fiber'
import { useEffect, useRef, type MutableRefObject } from 'react'
import { diagLog } from '../recorder/_diagLog'

interface ComposerLike {
  render: (deltaTime?: number) => void
}

interface Props {
  composerRef?: MutableRefObject<ComposerLike | null>
}

export function AudioInvalidator({}: Props) {
  const setFrameloop = useThree((s) => s.setFrameloop)
  const advance = useThree((s) => s.advance)
  const tickCountRef = useRef(0)

  useEffect(() => {
    const onStart = () => {
      setFrameloop('never')
      tickCountRef.current = 0
      diagLog('[ai] export-start: frameloop=never')
    }
    const onTick = (e: Event) => {
      const t = e instanceof CustomEvent && typeof e.detail === 'number'
        ? e.detail
        : performance.now() / 1000
      try {
        advance(t, true)
      } catch (err) {
        console.error('[ai] advance error', err)
      }
      if (tickCountRef.current < 5) {
        diagLog(`[ai] tick #${tickCountRef.current} t=${t.toFixed(3)}s`)
        tickCountRef.current++
      }
    }
    const onEnd = () => {
      setFrameloop('always')
      diagLog(`[ai] export-end after ${tickCountRef.current} ticks`)
    }
    window.addEventListener('mvapp-export-start', onStart)
    window.addEventListener('mvapp-export-tick', onTick)
    window.addEventListener('mvapp-export-end', onEnd)
    return () => {
      window.removeEventListener('mvapp-export-start', onStart)
      window.removeEventListener('mvapp-export-tick', onTick)
      window.removeEventListener('mvapp-export-end', onEnd)
    }
  }, [setFrameloop, advance])

  return null
}
