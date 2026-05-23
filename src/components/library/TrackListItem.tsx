import { Play, Pause, X } from 'lucide-react'
import type { LibraryTrack } from '../../store/libraryStore'
import { formatDuration } from '../../utils/format'
import PlayingIndicator from '../PlayingIndicator'

interface TrackListItemProps {
  track: LibraryTrack
  isActive: boolean
  isPlaying: boolean
  onPlay: () => void
  onRemove: () => void
}

export default function TrackListItem({
  track,
  isActive,
  isPlaying,
  onPlay,
  onRemove,
}: TrackListItemProps) {
  const showPause = isActive && isPlaying

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPlay}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPlay()
        }
      }}
      className={`group t-bg-border ${isActive ? '' : 'hov-bg-soft'}`}
      style={{
        height: 64,
        padding: 12,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: isActive ? 'var(--bg-elev)' : 'transparent',
        border: `1px solid ${isActive ? 'var(--border-active)' : 'transparent'}`,
        cursor: 'pointer',
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onPlay()
        }}
        title={showPause ? 'Пауза' : 'Воспроизвести'}
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: 'none',
          background: isActive ? 'var(--fg)' : 'transparent',
          color: isActive ? 'var(--bg)' : 'var(--fg-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {showPause ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
      </button>

      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 6,
          flexShrink: 0,
          overflow: 'hidden',
          background: track.cover
            ? 'transparent'
            : 'linear-gradient(135deg, var(--bg-elev) 0%, var(--bg-hover) 100%)',
          border: '1px solid var(--border)',
        }}
      >
        {track.cover ? (
          <img
            src={track.cover}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : null}
      </div>

      <div className="flex flex-col min-w-0 flex-1" style={{ gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span
            className="truncate"
            style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg)', letterSpacing: '-0.005em' }}
          >
            {track.name}
          </span>
          {showPause ? <PlayingIndicator /> : null}
        </div>
        <div className="truncate" style={{ fontSize: 12, color: 'var(--fg-soft)' }}>
          {track.artist}
        </div>
      </div>

      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          color: 'var(--fg-mute)',
          width: 48,
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        {formatDuration(track.duration)}
      </span>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        title="Удалить"
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          width: 24,
          height: 24,
          background: 'transparent',
          border: 'none',
          color: 'var(--fg-mute)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'rgb(239, 68, 68)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--fg-mute)'
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
