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
      animate={{
        opacity: isFullscreen ? 0 : 1,
        x: isFullscreen ? -50 : 0,
      }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      style={{ pointerEvents: isFullscreen ? 'none' : 'auto' }}
    >
      <div className="sidebar__brand-row">
        <div className="sidebar__brand">
          <div className="sidebar__brand-mark" aria-hidden="true" />
          <span className="sidebar__brand-name">Music Viz</span>
        </div>
        <ThemeToggle />
      </div>

      <nav className="sidebar__nav" aria-label="Визуализаторы">
        {[...groups.entries()].map(([category, list]) => (
          <div key={category} className="sidebar__group">
            <div className="sidebar__label">{category}</div>
            {list.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`nav-item${activeKey === item.key ? ' nav-item--active' : ''}`}
                onClick={() => onSelect(item.key)}
              >
                <span className="nav-item__icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      {footer}
    </motion.aside>
  )
}

function groupByCategory(items: VizItem[]): Map<string, VizItem[]> {
  const map = new Map<string, VizItem[]>()
  for (const item of items) {
    const group = map.get(item.category) ?? []
    group.push(item)
    map.set(item.category, group)
  }
  return map
}
