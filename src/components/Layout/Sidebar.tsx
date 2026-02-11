import { useMemo, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ThemeToggle } from './ThemeToggle'

export interface VizItem {
  key: string
  label: string
  icon: string
  category: string
}

interface SidebarProps {
  items: VizItem[]
  activeKey: string
  onSelect: (key: string) => void
  footer?: ReactNode
  isFullscreen?: boolean
}

export function Sidebar({ items, activeKey, onSelect, footer, isFullscreen = false }: SidebarProps) {
  const groups = useMemo(() => groupByCategory(items), [items])

  return (
    <motion.aside
      className="sidebar"
}
)
