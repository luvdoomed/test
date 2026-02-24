import { create } from 'zustand'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'mv-theme'
const DEFAULT_THEME: Theme = 'dark'

function readSavedTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME
  const saved = window.localStorage.getItem(STORAGE_KEY)
  return saved === 'light' || saved === 'dark' ? saved : DEFAULT_THEME
}

function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, theme)
  }
}

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readSavedTheme(),
  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    set({ theme: next })
  },
}))

// синхронизация атрибута html сразу при загрузке модуля
if (typeof document !== 'undefined') {
  applyTheme(readSavedTheme())
}
