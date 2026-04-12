import { toast } from 'sonner'
import { useThemeStore, type Theme } from '../../store/themeStore'

const THEME_LABEL: Record<Theme, string> = {
  light: 'Светлая тема',
  dark: 'Тёмная тема',
}

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  function pick(next: Theme) {
    if (next === theme) return
    setTheme(next)
    toast(THEME_LABEL[next])
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Тема">
      <button
        type="button"
        className={`theme-toggle__btn is-sun${theme === 'light' ? ' theme-toggle__btn--active' : ''}`}
        onClick={() => pick('light')}
        aria-label="Светлая тема"
        aria-pressed={theme === 'light'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" />
          <path d="M12 2v2.5" />
          <path d="M12 19.5v2.5" />
          <path d="M2 12h2.5" />
          <path d="M19.5 12h2.5" />
          <path d="M4.9 4.9l1.8 1.8" />
          <path d="M17.3 17.3l1.8 1.8" />
          <path d="M19.1 4.9l-1.8 1.8" />
          <path d="M6.7 17.3l-1.8 1.8" />
        </svg>
      </button>
      <button
        type="button"
        className={`theme-toggle__btn is-moon${theme === 'dark' ? ' theme-toggle__btn--active' : ''}`}
        onClick={() => pick('dark')}
        aria-label="Тёмная тема"
        aria-pressed={theme === 'dark'}
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6 6 0 0 0 10.5 10.5z" />
        </svg>
      </button>
    </div>
  )
}
