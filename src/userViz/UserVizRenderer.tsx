import { useMemo } from 'react'
import { useAudioStore } from '../store/audioStore'
import { findActiveLrcIndex } from '../utils/lrcParser'
import { UserVizErrorBoundary, UserVizErrorFallback } from './UserVizErrorBoundary'
import type { UserVisualizerRuntime } from './types'

interface UserVizRendererProps {
  runtime: UserVisualizerRuntime
}

export default function UserVizRenderer({ runtime }: UserVizRendererProps) {
  const audioData = useAudioStore((s) => s.audioData)
  const beat = useAudioStore((s) => s.beat)
  const energy = useAudioStore((s) => s.energy)
  const currentTime = useAudioStore((s) => s.currentTime)
  const lrcLines = useAudioStore((s) => s.lrcLines)
  const isPlaying = useAudioStore((s) => s.isPlaying)

  const activeLineIndex = useMemo(
    () => findActiveLrcIndex(lrcLines, currentTime),
    [lrcLines, currentTime],
  )
  const activeLineText =
    activeLineIndex >= 0 ? (lrcLines[activeLineIndex]?.text ?? '') : ''

  if (!runtime.component) {
    return <UserVizErrorFallback message={runtime.error ?? undefined} />
  }

  const Component = runtime.component

  return (
    <UserVizErrorBoundary resetKey={runtime.id}>
      <Component
        audioData={audioData}
        beat={beat}
        energy={energy}
        currentTime={currentTime}
        lrcLines={lrcLines}
        activeLineIndex={activeLineIndex}
        activeLineText={activeLineText}
        isPlaying={isPlaying}
      />
    </UserVizErrorBoundary>
  )
}
