import { create } from 'zustand'

export type Tab = 'visualizers' | 'library' | 'wave' | 'user-viz'

export type LibraryView = 'list' | 'grid'

interface UIStore {
  currentTab: Tab
  overlayOpen: boolean
  selectedVizId: string | null
  searchQuery: string
  isFullscreen: boolean
  exportOpen: boolean
  libraryView: LibraryView
  setTab: (tab: Tab) => void
  openOverlay: (vizId: string) => void
  closeOverlay: () => void
  setSearchQuery: (q: string) => void
  setSelectedVizId: (id: string | null) => void
  setFullscreen: (v: boolean) => void
  setExportOpen: (v: boolean) => void
  setLibraryView: (v: LibraryView) => void
  cycleVisualizer: (direction: 'next' | 'prev', vizIds: string[]) => void
}

export const useUIStore = create<UIStore>((set, get) => ({
  currentTab: 'visualizers',
  overlayOpen: false,
  selectedVizId: null,
  searchQuery: '',
  isFullscreen: false,
  exportOpen: false,
  libraryView: 'list',
  setTab: (tab) => set({ currentTab: tab }),
  openOverlay: (vizId) => set({ overlayOpen: true, selectedVizId: vizId }),
  closeOverlay: () => set({ overlayOpen: false, isFullscreen: false }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSelectedVizId: (id) => set({ selectedVizId: id }),
  setFullscreen: (v) => set({ isFullscreen: v }),
  setExportOpen: (v) => set({ exportOpen: v }),
  setLibraryView: (v) => set({ libraryView: v }),
  cycleVisualizer: (direction, vizIds) => {
    if (vizIds.length === 0) return
    const current = get().selectedVizId
    const idx = current ? vizIds.indexOf(current) : -1
    const step = direction === 'next' ? 1 : -1
    const nextIdx = idx === -1 ? 0 : (idx + step + vizIds.length) % vizIds.length
    set({ selectedVizId: vizIds[nextIdx] })
  },
}))
