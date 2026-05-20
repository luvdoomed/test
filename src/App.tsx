import { useEffect, useRef, useState } from 'react'
import { save } from '@tauri-apps/plugin-dialog'
import { useUIStore } from './store/uiStore'
import { useThemeStore } from './store/themeStore'
import { useAudioStore } from './store/audioStore'
import { useLibraryStore } from './store/libraryStore'
import { useUserVizStore } from './userViz/userVizStore'
import { audioEngine } from './audio/audioEngine'
import { autoPlayIfLyricsReady, loadTrack } from './library/playback'
import { runRecording } from './recorder/recordController'
import { applyStoredSettingsOnStartup } from './store/settingsStore'
import { useAuthStore } from './store/authStore'
import { isTauri } from './utils/platform'
import { pickVizForMood, getLastAutoPickedViz } from './audio/moodEngine'
import { getAllVisualizersInfoSnapshot } from './gallery/all'
import TopNav from './components/TopNav'
import ProfileModal from './components/ProfileModal'
import SettingsModal from './components/SettingsModal'
import LyricsSearchModal from './components/player/LyricsSearchModal'
import VisualizersGallery from './pages/VisualizersGallery'
import Library from './pages/Library'
import Wave from './pages/Wave'
import UserVizPage from './pages/UserVizPage'
import PlayerOverlay from './components/player/PlayerOverlay'
import MiniPlayer from './components/MiniPlayer'
import {
  ExportModal,
  ExportProgressOverlay,
  type ExportSettings,
} from './components/ExportModal'

interface ExportProgress {
  current: number
  total: number
  startedAt: number
}


export default function App() {
  const currentTab = useUIStore((s) => s.currentTab)
  const exportOpen = useUIStore((s) => s.exportOpen)
  const setExportOpen = useUIStore((s) => s.setExportOpen)
  const profileOpen = useUIStore((s) => s.profileOpen)
  const setProfileOpen = useUIStore((s) => s.setProfileOpen)
  const settingsOpen = useUIStore((s) => s.settingsOpen)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const setFullscreen = useUIStore((s) => s.setFullscreen)
  useThemeStore()

  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null)
  const exportCancelledRef = useRef(false)

  // авто-подбор визы при смене трека в режиме настроения
  const currentTrackId = useLibraryStore((s) => s.currentTrackId)
  const currentPlaylistMood = useAudioStore((s) => s.currentPlaylistMood)
  const clearPlaylistQueue = useAudioStore((s) => s.clearPlaylistQueue)
  const setSelectedVizId = useUIStore((s) => s.setSelectedVizId)
  const selectedVizId = useUIStore((s) => s.selectedVizId)

  useEffect(() => {
    if (!currentPlaylistMood || !currentTrackId) return
    const pool = getAllVisualizersInfoSnapshot()
    const picked = pickVizForMood(currentPlaylistMood, currentTrackId, pool)
    if (picked) setSelectedVizId(picked)
  }, [currentTrackId, currentPlaylistMood, setSelectedVizId])

  useEffect(() => {
    if (!currentPlaylistMood) return
    if (!selectedVizId) return
    if (selectedVizId === getLastAutoPickedViz()) return
    clearPlaylistQueue()
  }, [selectedVizId, currentPlaylistMood, clearPlaylistQueue])

  useEffect(() => {
    audioEngine.onTrackEnd = () => {
      const audio = useAudioStore.getState()
      const lib = useLibraryStore.getState()
      if (!audio.currentPlaylistMood || audio.playlistQueue.length === 0) return
      const idx = lib.currentTrackId ? audio.playlistQueue.indexOf(lib.currentTrackId) : -1
      if (idx === -1 || idx >= audio.playlistQueue.length - 1) return
      const nextId = audio.playlistQueue[idx + 1]
      const nextTrack = lib.tracks.find((t) => t.id === nextId)
      if (!nextTrack) return
      void (async () => {
        try {
          await loadTrack(nextTrack)
          autoPlayIfLyricsReady()
          lib.setCurrentTrack(nextTrack.id)
        } catch (err) {
          console.warn('[wave] auto-advance не удался', err)
        }
      })()
    }
    return () => { audioEngine.onTrackEnd = null }
  }, [])

  const loadLibraryFromDisk = useLibraryStore((s) => s.loadLibraryFromDisk)
  const loadUserVizFromDisk = useUserVizStore((s) => s.loadFromDisk)
  const restoreSession = useAuthStore((s) => s.restoreSession)
  useEffect(() => {
    void (async () => {
      applyStoredSettingsOnStartup()
      await loadLibraryFromDisk()
      await loadUserVizFromDisk()
      await restoreSession()
    })()
  }, [loadLibraryFromDisk, loadUserVizFromDisk, restoreSession])

  async function onExportStart(settings: ExportSettings) {
    setExportOpen(false)

    if (!isTauri()) {
      alert('Экспорт видео доступен только в desktop-версии. Скачай Mac/Windows app для рендера.')
      return
    }

    const buffer = audioEngine.getAudioBuffer()
    const audioBytes = audioEngine.getOriginalAudioBytes()
    if (!buffer || !audioBytes) {
      alert('Сначала загрузи трек')
      return
    }
    const audioExt = audioEngine.getOriginalAudioExt()
    const { width, height, fps } = settings

    const baseName = (useAudioStore.getState().trackInfo.title || 'visualization').replace(
      /[\\/:*?"<>|]/g,
      '_',
    )

    let path: string | null = null
    try {
      path = await save({
        defaultPath: `${baseName}.mp4`,
        filters: [{ name: 'MP4 video', extensions: ['mp4'] }],
      })
    } catch (err) {
      console.error('[export] ошибка диалога:', err)
      return
    }
    if (!path) return

    exportCancelledRef.current = false
    const startedAt = Date.now()
    setExportProgress({ current: 0, total: 1, startedAt })

    setFullscreen(true)

    try {
      await new Promise((r) => setTimeout(r, 200))

      await runRecording({
        audioBuffer: buffer,
        fps,
        width,
        height,
        audioBytes,
        audioExtension: audioExt,
        outputPath: path,
        onProgress: (f, total) => {
          if (exportCancelledRef.current) return
          setExportProgress({ current: f, total, startedAt })
        },
      })
    } catch (err) {
      console.error('[export] упал:', err)
      const msg = String(err)
      if (msg.includes('ffmpeg') || msg.toLowerCase().includes('no such file')) {
        alert('Требуется ffmpeg. Установите: brew install ffmpeg (Mac) или скачайте с ffmpeg.org (Windows)')
      } else {
        alert(`Ошибка экспорта: ${msg}`)
      }
    } finally {
      setExportProgress(null)
      setFullscreen(false)
    }
  }

  function cancelExport() {
    // отмены сигнала у runRecording нет спрятать оверлей
    exportCancelledRef.current = true
    setExportProgress(null)
  }

  useAudioStore((s) => s.trackInfo.title)
  const duration = audioEngine.getDuration()

  return (
    <>
      <TopNav />
      <div style={{ paddingTop: 60 }}>
        {currentTab === 'visualizers' && <VisualizersGallery />}
        {currentTab === 'library' && <Library />}
        {currentTab === 'wave' && <Wave />}
        {currentTab === 'user-viz' && <UserVizPage />}
      </div>
      <PlayerOverlay />
      <MiniPlayer />
      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        onStart={onExportStart}
        trackDurationSec={duration}
      />
      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LyricsSearchModal />
      {exportProgress ? (
        <ExportProgressOverlay
          current={exportProgress.current}
          total={exportProgress.total}
          startedAt={exportProgress.startedAt}
          onCancel={cancelExport}
        />
      ) : null}
    </>
  )
}
