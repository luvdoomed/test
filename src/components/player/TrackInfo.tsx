import { useAudioStore } from '../../store/audioStore'

export default function TrackInfo() {
  const trackInfo = useAudioStore((s) => s.trackInfo)
  const title = trackInfo.title || 'Без названия'
  const artist = trackInfo.artist || 'Неизвестный исполнитель'

  return (
    <div className="flex items-center" style={{ gap: 12 }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 8,
          flexShrink: 0,
          overflow: 'hidden',
          background: trackInfo.cover
            ? 'transparent'
            : 'linear-gradient(135deg, var(--bg-elev) 0%, var(--bg-soft) 100%)',
          border: '1px solid var(--border)',
        }}
      >
        {trackInfo.cover ? (
          <img
            src={trackInfo.cover}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : null}
      </div>
      <div className="flex flex-col min-w-0 flex-1" style={{ gap: 2 }}>
        <div
          className="truncate"
          style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.01em' }}
        >
          {title}
        </div>
        <div className="truncate" style={{ fontSize: 12, color: 'var(--fg-soft)' }}>
          {artist}
        </div>
      </div>
    </div>
  )
}
