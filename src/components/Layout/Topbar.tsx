import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface TopbarProps {
  title?: ReactNode
  subtitle?: string
  onBack?: () => void
  actions?: ReactNode
  isFullscreen?: boolean
}

export function Topbar({ title, subtitle, onBack, actions, isFullscreen = false }: TopbarProps) {
  return (
    <motion.header
      className="topbar"
      animate={{
        opacity: isFullscreen ? 0 : 1,
        y: isFullscreen ? -30 : 0,
      }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      style={{ pointerEvents: isFullscreen ? 'none' : 'auto' }}
    >
}
)
