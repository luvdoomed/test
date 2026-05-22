import { type CSSProperties } from 'react'
import { Play, Pause, X, CloudDownload, CloudUpload } from 'lucide-react'
import type { LibraryTrack } from '../../store/libraryStore'
import TrackCloudBadge from './TrackCloudBadge'

interface TrackListItemProps {
  track: LibraryTrack
  isActive: boolean
  isPlaying: boolean
  onPlay: () => void
  onRemove: () => void
  selectionMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
  needsLocalFile?: boolean
  hasCloudAudio?: boolean
  cloudBusy?: boolean
  onCloudDownload?: () => void
  onCloudUpload?: () => void
}

function fmt(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return '—'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

const iconBtnStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--bg-soft)',
  color: 'var(--fg-soft)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
}

export default function TrackListItem({
  track,
  isActive,
  isPlaying,
  onPlay,
  onRemove,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  needsLocalFile = false,
  hasCloudAudio = false,
  cloudBusy = false,
  onCloudDownload,
  onCloudUpload,
}: TrackListItemProps) {
  const showPause = isActive && isPlaying

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (selectionMode) {
          onToggleSelect?.()
          return
        }
        onPlay()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (selectionMode) {
            onToggleSelect?.()
            return
          }
          onPlay()
        }
      }}
      className="group"
      style={{
        height: 64,
        padding: 12,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background:
          selected && !isActive ? 'var(--bg-soft)' : isActive ? 'var(--bg-elev)' : 'transparent',
        border: `1px solid ${
          selected ? 'var(--border-active)' : isActive ? 'var(--border-active)' : 'transparent'
        }`,
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        if (selectionMode) return
        if (isActive) return
        e.currentTarget.style.background = 'var(--bg-soft)'
      }}
      onMouseLeave={(e) => {
        if (selectionMode) return
        if (isActive) e.currentTarget.style.background = 'var(--bg-elev)'
        else if (selected) e.currentTarget.style.background = 'var(--bg-soft)'
        else e.currentTarget.style.background = 'transparent'
      }}
    >
      {selectionMode ? (
        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
          style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect?.()}
            title="Выбрать"
            style={{
              width: 18,
              height: 18,
              accentColor: 'var(--fg)',
              cursor: 'pointer',
            }}
          />
        </div>
      ) : null}
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
        <div
          className="truncate"
          style={{
            fontSize: 12,
            color: 'var(--fg-soft)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minWidth: 0,
          }}
        >
          <span className="truncate" style={{ minWidth: 0 }}>
            {track.artist}
          </span>
          <TrackCloudBadge needsLocalFile={needsLocalFile} hasCloudAudio={hasCloudAudio} />
        </div>
      </div>

      {!selectionMode && needsLocalFile && hasCloudAudio && onCloudDownload ? (
        <button
          type="button"
          title="Скачать аудио из облака"
          disabled={cloudBusy}
          onClick={(e) => {
            e.stopPropagation()
            onCloudDownload()
          }}
          style={iconBtnStyle}
        >
          <CloudDownload size={14} />
        </button>
      ) : null}

      {!selectionMode && !needsLocalFile && onCloudUpload ? (
        <button
          type="button"
          title="Прикрепить аудио к облаку (до 500 МБ)"
          disabled={cloudBusy}
          onClick={(e) => {
            e.stopPropagation()
            onCloudUpload()
          }}
          style={iconBtnStyle}
        >
          <CloudUpload size={14} />
        </button>
      ) : null}

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
        {fmt(track.duration)}
      </span>

      {!selectionMode ? (
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
      ) : null}
    </div>
  )
}

function PlayingIndicator() {
  const barStyle = {
    width: 2,
    height: 12,
    background: 'var(--fg)',
    borderRadius: 1,
    transformOrigin: 'bottom',
    display: 'inline-block',
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'flex-end',
        gap: 2,
        height: 12,
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <span style={{ ...barStyle, animation: 'eqA 0.8s ease-in-out infinite' }} />
      <span style={{ ...barStyle, animation: 'eqB 0.8s ease-in-out infinite 0.15s' }} />
      <span style={{ ...barStyle, animation: 'eqC 0.8s ease-in-out infinite 0.3s' }} />
      <style>{`
        @keyframes eqA { 0%,100% { transform: scaleY(0.4) } 50% { transform: scaleY(1) } }
        @keyframes eqB { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(0.4) } }
        @keyframes eqC { 0%,100% { transform: scaleY(0.5) } 50% { transform: scaleY(0.95) } }
      `}</style>
    </span>
  )
}
