import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { X, Play, Pause, ArrowLeft, Cloud, CloudDownload, HardDrive } from 'lucide-react'
import {
  MOOD_LABELS,
  MOOD_GRADIENTS,
  getTracksByMood,
  pickVizForMood,
  type MoodId,
} from '../../audio/moodEngine'
import { useLibraryStore, type LibraryTrack } from '../../store/libraryStore'
import { useAudioStore } from '../../store/audioStore'
import { useUIStore } from '../../store/uiStore'
import { audioEngine } from '../../audio/audioEngine'
import { autoPlayIfLyricsReady, loadTrack } from '../../library/playback'
import { GALLERY } from '../../gallery/registry'
import { getAllVisualizersInfoSnapshot } from '../../gallery/all'
import { pluralTrack } from '../../utils/plural'
import { useAuthStore } from '../../store/authStore'
import { trackCanPlay, trackNeedsLocalFile } from '../../utils/trackCloud'
import { downloadCloudAudioToDevice } from '../../services/cloudTrackAudio'
import TrackCloudBadge from '../library/TrackCloudBadge'

interface MoodPlaylistModalProps {
  moodId: MoodId
  onClose: () => void
  onBack?: () => void
}

function fmtDuration(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return '—'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function MoodPlaylistModal({ moodId, onClose, onBack }: MoodPlaylistModalProps) {
  const tracks = useLibraryStore((s) => s.tracks)
  const currentTrackId = useLibraryStore((s) => s.currentTrackId)
  const setCurrentTrack = useLibraryStore((s) => s.setCurrentTrack)
  const isPlaying = useAudioStore((s) => s.isPlaying)
  const setPlaylistQueue = useAudioStore((s) => s.setPlaylistQueue)
  const openOverlay = useUIStore((s) => s.openOverlay)
  const setSelectedVizId = useUIStore((s) => s.setSelectedVizId)
  const selectedVizId = useUIStore((s) => s.selectedVizId)
  const loggedIn = useAuthStore((s) => Boolean(s.token))
  const cloudAudioTrackIds = useAuthStore((s) => s.cloudAudioTrackIds)

  const [cloudBusyId, setCloudBusyId] = useState<string | null>(null)
  const [playHint, setPlayHint] = useState<string | null>(null)

  const moodTracks = useMemo(() => getTracksByMood(tracks, moodId), [tracks, moodId])
  const playableTracks = useMemo(
    () => moodTracks.filter((t) => trackCanPlay(t, cloudAudioTrackIds)),
    [moodTracks, cloudAudioTrackIds],
  )
  const moodTrackIds = useMemo(() => playableTracks.map((t) => t.id), [playableTracks])
  const unplayableCount = moodTracks.length - playableTracks.length

  useEffect(() => {
    if (!playHint) return
    const t = window.setTimeout(() => setPlayHint(null), 4500)
    return () => clearTimeout(t)
  }, [playHint])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  async function switchToTrack(track: LibraryTrack) {
    setPlaylistQueue(moodTrackIds, moodId)
    setCurrentTrack(track.id)
    try {
      await loadTrack(track)
      autoPlayIfLyricsReady()
    } catch (err) {
      console.warn('[wave] не удалось запустить трек', err)
    }
  }

  async function cloudDownload(trackId: string) {
    setCloudBusyId(trackId)
    try {
      await downloadCloudAudioToDevice(trackId)
    } catch (err) {
      setPlayHint(err instanceof Error ? err.message : 'Не удалось скачать из облака')
    } finally {
      setCloudBusyId(null)
    }
  }

  function handleTrackRowClick(track: LibraryTrack) {
    if (!trackCanPlay(track, cloudAudioTrackIds)) {
      setPlayHint('Добавь MP3 в библиотеку или скачай с облака (иконка ↓ у трека)')
      return
    }
    if (track.id === currentTrackId) {
      if (isPlaying) audioEngine.pause()
      else audioEngine.play()
      return
    }
    void switchToTrack(track)
  }

  async function handlePlayAll() {
    if (playableTracks.length === 0) {
      setPlayHint(
        moodTracks.length > 0
          ? 'В этом плейлисте нет треков с аудио на этом устройстве'
          : 'В этом плейлисте пока нет треков',
      )
      return
    }

    const playingInThisMood = currentTrackId
      ? moodTrackIds.includes(currentTrackId)
      : false

    if (playingInThisMood) {
      const vizId = selectedVizId ?? GALLERY[0].id
      openOverlay(vizId)
      onClose()
      return
    }

    const first = playableTracks[0]
    setPlaylistQueue(moodTrackIds, moodId)
    const pool = getAllVisualizersInfoSnapshot()
    const picked = pickVizForMood(moodId, first.id, pool, { force: true })
    const vizId = picked ?? selectedVizId ?? GALLERY[0].id
    setSelectedVizId(vizId)
    setCurrentTrack(first.id)
    try {
      await loadTrack(first)
      autoPlayIfLyricsReady()
    } catch (err) {
      console.warn('[wave] не удалось запустить плейлист', err)
    }
    openOverlay(vizId)
    onClose()
  }

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        animation: 'moodModalFade 0.18s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 680,
          maxHeight: '82vh',
          background: 'var(--bg)',
          borderRadius: 18,
          border: '1px solid var(--border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'moodModalSlide 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        <ModalHeader
          moodId={moodId}
          count={moodTracks.length}
          playableCount={playableTracks.length}
          onPlayAll={handlePlayAll}
          onClose={onClose}
          onBack={onBack}
          playDisabled={playableTracks.length === 0}
        />

        {playHint ? (
          <div
            style={{
              margin: '0 16px 8px',
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--fg-soft)',
              background: 'var(--bg-soft)',
              border: '1px solid var(--border)',
            }}
          >
            {playHint}
          </div>
        ) : null}

        {unplayableCount > 0 ? (
          <div
            style={{
              margin: '0 16px 10px',
              fontSize: 11,
              color: 'var(--fg-mute)',
              lineHeight: 1.45,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <HardDrive
              size={12}
              strokeWidth={2}
              style={{ flexShrink: 0, marginTop: 1, color: 'var(--premium)' }}
              aria-hidden
            />
            <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
              <span>
                {unplayableCount} {pluralTrack(unplayableCount)} без MP3 — добавь в библиотеку или
              </span>
              <Cloud size={11} strokeWidth={2} aria-label="Аудио в облаке" />
              <CloudDownload
                size={11}
                strokeWidth={2}
                aria-label="Скачать из облака"
              />
            </span>
          </div>
        ) : null}

        <div
          style={{
            overflowY: 'auto',
            padding: '8px 12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {moodTracks.length === 0 ? (
            <div
              style={{
                padding: '40px 16px',
                textAlign: 'center',
                color: 'var(--fg-mute)',
                fontSize: 13,
              }}
            >
              В этом плейлисте пока нет треков
            </div>
          ) : (
            moodTracks.map((t) => (
              <PlaylistTrackRow
                key={t.id}
                track={t}
                isCurrent={t.id === currentTrackId}
                isPlaying={isPlaying && t.id === currentTrackId}
                canPlay={trackCanPlay(t, cloudAudioTrackIds)}
                needsLocalFile={trackNeedsLocalFile(t)}
                hasCloudAudio={loggedIn && cloudAudioTrackIds.includes(t.id)}
                cloudBusy={cloudBusyId === t.id}
                onCloudDownload={
                  loggedIn &&
                  trackNeedsLocalFile(t) &&
                  cloudAudioTrackIds.includes(t.id)
                    ? () => void cloudDownload(t.id)
                    : undefined
                }
                onActivate={() => handleTrackRowClick(t)}
              />
            ))
          )}
        </div>
      </div>

      <style>{`
        @keyframes moodModalFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes moodModalSlide {
          from { opacity: 0; transform: translateY(8px) scale(0.98) }
          to { opacity: 1; transform: translateY(0) scale(1) }
        }
      `}</style>
    </div>
  )

  return createPortal(content, document.body)
}

interface ModalHeaderProps {
  moodId: MoodId
  count: number
  playableCount: number
  onPlayAll: () => void
  onClose: () => void
  onBack?: () => void
  playDisabled?: boolean
}

function ModalHeader({
  moodId,
  count,
  playableCount,
  onPlayAll,
  onClose,
  onBack,
  playDisabled = false,
}: ModalHeaderProps) {
  const empty = count === 0
  const subtitle =
    empty
      ? 'Пока нет треков'
      : playableCount < count
        ? `${playableCount} из ${count} ${pluralTrack(count)} · можно слушать`
        : `${count} ${pluralTrack(count)}`
  return (
    <div
      style={{
        padding: '20px 16px 20px 20px',
        background: empty ? 'var(--bg-soft)' : MOOD_GRADIENTS[moodId],
        color: empty ? 'var(--fg)' : '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Другое настроение"
          style={{
            alignSelf: 'flex-start',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px 6px 8px',
            borderRadius: 999,
            border: 'none',
            background: 'rgba(0,0,0,0.18)',
            color: empty ? 'var(--fg-soft)' : '#0a0a0a',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'inherit',
            letterSpacing: '-0.005em',
            whiteSpace: 'nowrap',
            opacity: 0.85,
            transition: 'background 0.15s, opacity 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.3)'
            e.currentTarget.style.opacity = '1'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.18)'
            e.currentTarget.style.opacity = '0.85'
          }}
        >
          <ArrowLeft size={13} />
          Другое настроение
        </button>
      ) : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
            marginBottom: 6,
          }}
        >
          {MOOD_LABELS[moodId]}
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            opacity: 0.85,
          }}
        >
          {subtitle}
        </div>
      </div>

      {!empty && playableCount > 0 ? (
        <BigPlayButton onClick={onPlayAll} disabled={playDisabled} />
      ) : null}

      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть"
        style={{
          alignSelf: 'flex-start',
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(0,0,0,0.18)',
          color: empty ? 'var(--fg-soft)' : '#0a0a0a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'background 0.15s',
          flexShrink: 0,
          opacity: 0.7,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0,0,0,0.3)'
          e.currentTarget.style.opacity = '1'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(0,0,0,0.18)'
          e.currentTarget.style.opacity = '0.7'
        }}
      >
        <X size={15} />
      </button>
    </div>
  )
}

interface BigPlayButtonProps {
  onClick: () => void
  disabled?: boolean
}

function BigPlayButton({ onClick, disabled = false }: BigPlayButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Запустить плейлист"
      style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        border: 'none',
        background: '#ffffff',
        color: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(0,0,0,0.28)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)'
        e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.35)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
        e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.28)'
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.97)'
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)'
      }}
    >
      <Play size={22} fill="currentColor" style={{ marginLeft: 3 }} />
    </button>
  )
}

const cloudBtnStyle: CSSProperties = {
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

interface PlaylistTrackRowProps {
  track: LibraryTrack
  isCurrent: boolean
  isPlaying: boolean
  canPlay: boolean
  needsLocalFile?: boolean
  hasCloudAudio?: boolean
  cloudBusy?: boolean
  onCloudDownload?: () => void
  onActivate: () => void
}

function PlaylistTrackRow({
  track,
  isCurrent,
  isPlaying,
  canPlay,
  needsLocalFile = false,
  hasCloudAudio = false,
  cloudBusy = false,
  onCloudDownload,
  onActivate,
}: PlaylistTrackRowProps) {
  const [hovered, setHovered] = useState(false)

  const showOverlay = canPlay && (isCurrent || hovered)
  let overlayContent: React.ReactNode = null
  if (isCurrent && isPlaying) {
    overlayContent = hovered
      ? <Pause size={14} fill="currentColor" />
      : <PlayingIndicator color="#fff" />
  } else if (isCurrent && !isPlaying) {
    overlayContent = <Play size={14} fill="currentColor" style={{ marginLeft: 1 }} />
  } else if (hovered) {
    overlayContent = <Play size={14} fill="currentColor" style={{ marginLeft: 1 }} />
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onActivate()
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: 60,
        padding: '8px 12px',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: isCurrent
          ? 'var(--bg-elev)'
          : hovered
            ? 'var(--bg-soft)'
            : 'transparent',
        border: `1px solid ${isCurrent ? 'var(--border-active)' : 'transparent'}`,
        cursor: canPlay ? 'pointer' : 'default',
        opacity: canPlay ? 1 : 0.72,
        transition: 'background 0.15s, border-color 0.15s, opacity 0.15s',
      }}
    >
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
          position: 'relative',
        }}
      >
        {track.cover ? (
          <img
            src={track.cover}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : null}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.15s',
            color: '#fff',
            opacity: showOverlay ? 1 : 0,
            pointerEvents: 'none',
          }}
        >
          {overlayContent}
        </div>
      </div>

      <div className="flex flex-col min-w-0 flex-1" style={{ gap: 2 }}>
        <span
          className="truncate"
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--fg)',
            letterSpacing: '-0.005em',
          }}
        >
          {track.name}
        </span>
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

      {needsLocalFile && hasCloudAudio && onCloudDownload ? (
        <button
          type="button"
          title="Скачать аудио из облака"
          disabled={cloudBusy}
          onClick={(e) => {
            e.stopPropagation()
            onCloudDownload()
          }}
          style={cloudBtnStyle}
        >
          <CloudDownload size={14} />
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
        {fmtDuration(track.duration)}
      </span>
    </div>
  )
}

interface PlayingIndicatorProps {
  color?: string
}

function PlayingIndicator({ color = 'var(--fg)' }: PlayingIndicatorProps) {
  const barStyle = {
    width: 2,
    height: 12,
    background: color,
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
