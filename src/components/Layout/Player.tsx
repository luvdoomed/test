import { motion } from 'framer-motion'
import { CustomSlider } from '../ui/Slider'

interface PlayerProps {
  cover: string
  title: string
  artist: string
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  liked?: boolean
  isFullscreen?: boolean
  onPlayToggle: () => void
  onSkipBack: () => void
  onSkipForward: () => void
  onSeek: (time: number) => void
  onVolume: (value: number) => void
  onLikeToggle?: () => void
}

export function Player({
  cover,
  title,
  artist,
  isPlaying,
  currentTime,
  duration,
  volume,
  liked,
  isFullscreen = false,
  onPlayToggle,
  onSkipBack,
  onSkipForward,
  onSeek,
  onVolume,
  onLikeToggle,
}: PlayerProps) {
  const progressRatio = duration > 0 ? currentTime / duration : 0
  const coverStyle = cover ? { backgroundImage: `url(${cover})` } : undefined
  const coverKlass = cover ? 'cover' : 'cover cover--placeholder'

  return (
    <motion.footer
      className="player"
      animate={{
        opacity: isFullscreen ? 0 : 1,
        y: isFullscreen ? 50 : 0,
      }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      style={{ pointerEvents: isFullscreen ? 'none' : 'auto' }}
    >
      <div className="player__track">
        <div className={coverKlass} style={coverStyle} aria-hidden="true" />
        <div className="player__meta">
          <span className="player__title">{title || 'Нет трека'}</span>
          <span className="player__artist">{artist || 'Загрузи аудио файл'}</span>
        </div>
}
)
