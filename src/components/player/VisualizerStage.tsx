import VisualizerHost from './VisualizerHost'

interface VisualizerStageProps {
  vizId: string
  isFullscreen: boolean
}

export default function VisualizerStage({ vizId, isFullscreen }: VisualizerStageProps) {
  if (isFullscreen) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          background: '#000',
        }}
      >
        <VisualizerHost vizId={vizId} />
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#000',
        border: '1px solid var(--border)',
      }}
    >
      <VisualizerHost vizId={vizId} />
    </div>
  )
}
