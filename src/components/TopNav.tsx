import { useEffect, useRef } from 'react'
import { Search, Sun, Moon, Monitor, Settings } from 'lucide-react'
import { useUIStore, type Tab } from '../store/uiStore'
import { useThemeStore } from '../store/themeStore'

const TABS: { id: Tab; label: string }[] = [
  { id: 'visualizers', label: 'Визуализаторы' },
  { id: 'library', label: 'Библиотека' },
  { id: 'wave', label: 'Волна' },
  { id: 'user-viz', label: 'Мои' },
]

export default function TopNav() {
  const currentTab = useUIStore((s) => s.currentTab)
  const setTab = useUIStore((s) => s.setTab)
  const searchQuery = useUIStore((s) => s.searchQuery)
  const setSearchQuery = useUIStore((s) => s.setSearchQuery)
  const mode = useThemeStore((s) => s.mode)
  const cycleMode = useThemeStore((s) => s.cycleMode)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      if (!isCmdK) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const ThemeIcon = mode === 'dark' ? Sun : mode === 'light' ? Moon : Monitor

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-md"
      style={{
        height: 60,
        background: 'color-mix(in srgb, var(--bg) 70%, transparent)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        className="mx-auto flex h-full items-center gap-8"
        style={{ maxWidth: 1400, padding: '0 32px' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="relative flex items-center justify-center"
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: 'linear-gradient(135deg, #ffffff 0%, #a1a1aa 100%)',
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: 'var(--bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: 1, background: '#fafafa' }} />
            </div>
          </div>
          <span
            style={{
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: '-0.01em',
              color: 'var(--fg)',
            }}
          >
            Loomi
          </span>
        </div>

        <nav className="flex items-center gap-1">
          {TABS.map((tab) => {
            const active = tab.id === currentTab
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTab(tab.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  background: active ? 'var(--bg-elev)' : 'transparent',
                  color: active ? 'var(--fg)' : 'var(--fg-mute)',
                  transition: 'color 0.15s, background 0.15s',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.color = 'var(--fg)'
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.color = 'var(--fg-mute)'
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div
            className="flex items-center"
            style={{
              width: 240,
              height: 32,
              background: 'var(--bg-soft)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0 12px 0 10px',
              gap: 8,
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-active)'
              e.currentTarget.style.background = 'var(--bg-elev)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.background = 'var(--bg-soft)'
            }}
          >
            <Search size={14} style={{ color: 'var(--fg-mute)', flexShrink: 0 }} />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск визуализаторов"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--fg)',
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            />
            <kbd
              style={{
                marginLeft: 'auto',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                color: 'var(--fg-mute)',
                padding: '2px 5px',
                border: '1px solid var(--border)',
                borderRadius: 4,
                lineHeight: 1,
              }}
            >
              ⌘K
            </kbd>
          </div>

          <IconButton onClick={cycleMode} title={`Тема: ${mode}`}>
            <ThemeIcon size={14} />
          </IconButton>
          <IconButton onClick={() => {}} title="Настройки">
            <Settings size={14} />
          </IconButton>
        </div>
      </div>
    </header>
  )
}

interface IconButtonProps {
  onClick: () => void
  title: string
  children: React.ReactNode
}

function IconButton({ onClick, title, children }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--bg-soft)',
        color: 'var(--fg-mute)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'color 0.15s, border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--fg)'
        e.currentTarget.style.borderColor = 'var(--border-active)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--fg-mute)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      {children}
    </button>
  )
}
