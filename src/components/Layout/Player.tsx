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
}
)
