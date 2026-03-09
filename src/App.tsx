import {
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { save } from '@tauri-apps/plugin-dialog'
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import { createRoot } from 'react-dom/client'
import { Toaster, toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'

import { useThemeStore } from './store/themeStore'
import { useAudioStore } from './store/audioStore'
import { audioEngine } from './audio/audioEngine'
import { testOfflineAnalyzer } from './audio/offlineAnalyzer'
import { runRecording } from './recorder/recordController'
import { installShim, tickFrame, uninstallShim } from './recorder/rafShim'
import { type Frame as ProfilerFrame } from './profiler/testPatterns'
import { profileVisualizer, type VibeProfile } from './profiler/profiler'
import { setCachedProfile, getAllCachedProfiles } from './profiler/profileCache'
import { profileTrack } from './profiler/trackProfiler'
import { matchVisualizers, selectWeightedFromTop } from './profiler/matcher'
import { usePresetsStore } from './presets/presetsStore'
import { parseLrc } from './utils/lrcParser'
import { extractCoverColors, applyCoverPalette } from './utils/extractCoverColors'

import { AuraBackground } from './components/Layout/AuraBackground'
import { Sidebar } from './components/Layout/Sidebar'
import { Topbar } from './components/Layout/Topbar'
import { Player } from './components/Layout/Player'
import { Welcome } from './components/Welcome'
import { PresetsDrawer } from './components/PresetsDrawer'
import {
  ExportModal,
  ExportProgressOverlay,
  type AspectKey,
  type ExportSettings,
} from './components/ExportModal'

import { VIZ_ITEMS, renderVisualizer, type VisualizerMode } from './vizItems'

const ACCEPTED_EXT = ['.mp3', '.flac', '.wav']
const ACCEPTED_MIME = ['audio/mpeg', 'audio/flac', 'audio/wav', 'audio/x-wav']
const SKIP_SEC = 10

const WORK_SIZES: Record<AspectKey, { w: number; h: number }> = {
  '16:9': { w: 1600, h: 900 },
  '9:16': { w: 600, h: 1067 },
  '1:1': { w: 1000, h: 1000 },
}

const MOOD_RU: Record<VibeProfile['mood'], string> = {
  neon: 'неон',
  warm: 'тёплый',
  cold: 'холодный',
  dark: 'тёмный',
}

interface ExportProgress {
  current: number
  total: number
  startedAt: number
}

function isAudioFile(file: File): boolean {
  return (
    ACCEPTED_MIME.includes(file.type) ||
    ACCEPTED_EXT.some((ext) => file.name.toLowerCase().endsWith(ext))
  )
}

function isLrcFile(file: File): boolean {
  const n = file.name.toLowerCase()
  return n.endsWith('.lrc') || file.type === 'application/x-lrc' || file.type === 'text/plain'
}

function describeVibe(p: VibeProfile): string {
  let energyWord: string
  if (p.energy > 0.6) energyWord = 'энергичный'
  else if (p.energy >= 0.3) energyWord = 'средний'
  else energyWord = 'спокойный'

  let motionWord: string
  if (p.motion > 0.7) motionWord = 'быстрый'
  else if (p.motion >= 0.4) motionWord = 'ритмичный'
  else motionWord = 'медленный'

  return `${energyWord} · ${MOOD_RU[p.mood]} · ${motionWord}`
}

export default function App() {
  const title = useAudioStore((s) => s.trackInfo.title)
  const artist = useAudioStore((s) => s.trackInfo.artist)
  const cover = useAudioStore((s) => s.trackInfo.cover)
  const currentTime = useAudioStore((s) => s.currentTime)
  const isPlaying = useAudioStore((s) => s.isPlaying)
  const volume = useAudioStore((s) => s.volume)
  const autoMode = useAudioStore((s) => s.autoMode)
  const trackProfile = useAudioStore((s) => s.trackProfile)

  const theme = useThemeStore((s) => s.theme)
  const togglePresetsDrawer = usePresetsStore((s) => s.toggleDrawer)
  const setActivePresetVisualizer = usePresetsStore((s) => s.setActiveVisualizerId)

  const [activeViz, setActiveViz] = useState<VisualizerMode>('cosmic')
  const [dragging, setDragging] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null)
  const [profilingProgress, setProfilingProgress] = useState<{
    current: number
    total: number
    label: string
  } | null>(null)
  const [autoProfiling, setAutoProfiling] = useState(false)
  const [needsVisualizerProfiling, setNeedsVisualizerProfiling] = useState(false)
  const [liked, setLiked] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const exportCancelled = useRef(false)
  const profilingRunning = useRef(false)
  const profileTicket = useRef(0)
  const autoMatchRunning = useRef(false)

  const hasTrack = title !== ''
  const duration = audioEngine.getDuration()

  // проверка кэша профилей
  useEffect(() => {
    const cached = getAllCachedProfiles()
    if (Object.keys(cached).length === 0) setNeedsVisualizerProfiling(true)
  }, [])

  useEffect(() => {
    setActivePresetVisualizer(activeViz)
  }, [activeViz, setActivePresetVisualizer])

  useEffect(() => {
    if (!cover) {
      applyCoverPalette(null)
      return
    }
    let cancelled = false
    void extractCoverColors(cover).then((palette) => {
      if (!cancelled) applyCoverPalette(palette)
    })
    return () => {
      cancelled = true
    }
  }, [cover])

  // esc — выход из фуллскрина
  useEffect(() => {
    if (!isFullscreen) return
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Escape') setIsFullscreen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isFullscreen])

  const togglePlay = useCallback(() => {
    if (isPlaying) audioEngine.pause()
    else audioEngine.play()
  }, [isPlaying])

  const skipBackward = useCallback(() => {
    if (audioEngine.getDuration() <= 0) return
    const t = Math.max(0, useAudioStore.getState().currentTime - SKIP_SEC)
    audioEngine.seek(t)
  }, [])

  const skipForward = useCallback(() => {
    const d = audioEngine.getDuration()
    if (d <= 0) return
    const t = Math.min(d, useAudioStore.getState().currentTime + SKIP_SEC)
    audioEngine.seek(t)
  }, [])

  const handleSeek = useCallback((time: number) => {
    audioEngine.seek(time)
  }, [])

  const handleVolume = useCallback((value: number) => {
    audioEngine.setVolume(value)
  }, [])

  const handleLrcFile = useCallback(async (file: File) => {
    if (!isLrcFile(file)) return
    const text = await file.text()
    const lines = parseLrc(text)
    useAudioStore.getState().setLrcLines(lines)
  }, [])

  const runAutoMatch = useCallback(async (reason: 'track-load' | 'user-toggle') => {
    if (autoMatchRunning.current) return
    const buffer = audioEngine.getAudioBuffer()
    if (!buffer) return
    const cached = getAllCachedProfiles()
    if (Object.keys(cached).length === 0) {
      setNeedsVisualizerProfiling(true)
      return
    }

    const ticket = ++profileTicket.current
    autoMatchRunning.current = true
    setAutoProfiling(true)
    try {
      const profile = await profileTrack(buffer)
      if (ticket !== profileTicket.current) return
      const matches = matchVisualizers(profile, cached, 5)
      const state = useAudioStore.getState()
      state.setTrackProfile(profile)
      state.setSuggestedVisualizers(matches)
      console.log('[automode] reason=', reason, 'top:', matches.map((m) => `${m.id}:${m.distance.toFixed(3)}`).join(', '))
      const { chosenId } = selectWeightedFromTop(matches)
      if (!chosenId) return
      setActiveViz(chosenId as VisualizerMode)
      const item = VIZ_ITEMS.find((v) => v.key === chosenId)
      const label = item?.label ?? chosenId
      toast.success(`Авто выбрал: ${label}`, {
        description: `вайб: ${MOOD_RU[profile.mood]} · энергия ${profile.energy.toFixed(2)} · движение ${profile.motion.toFixed(2)}`,
      })
    } catch (err) {
      console.error('[automode] ошибка:', err)
    } finally {
      autoMatchRunning.current = false
      setAutoProfiling(false)
    }
  }, [])

  const handleAudioFile = useCallback(
    async (file: File) => {
      if (!isAudioFile(file)) return
      profileTicket.current++
      await audioEngine.loadFile(file)
      audioEngine.play()

      const state = useAudioStore.getState()
      state.setTrackProfile(null)
      state.setSuggestedVisualizers([])

      const loadedTitle = state.trackInfo.title || file.name.replace(/\.[^.]+$/, '')
      toast.success('Трек загружен', { description: loadedTitle })

      if (state.autoMode) await runAutoMatch('track-load')
    },
    [runAutoMatch],
  )

  const handlePickAudio = useCallback(
    async (file: File) => {
      await handleAudioFile(file)
    },
    [handleAudioFile],
  )

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(true)
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDragging(false)
  }

  async function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const list = Array.from(e.dataTransfer.files)
    if (list.length === 0) return
    const audio = list.find(isAudioFile)
    const lrc = list.find(isLrcFile)
    if (audio) await handleAudioFile(audio)
    if (lrc) await handleLrcFile(lrc)
  }

  function goBack() {
    audioEngine.stop()
    const s = useAudioStore.getState()
    s.setTrackInfo({ title: '', artist: '', album: '', cover: '' })
    s.setTrackProfile(null)
    s.setSuggestedVisualizers([])
    s.setLrcLines([])
    profileTicket.current++
  }

  function toggleAutoMode() {
    const s = useAudioStore.getState()
    const next = !s.autoMode
    s.setAutoMode(next)
    if (next && audioEngine.getAudioBuffer()) void runAutoMatch('user-toggle')
  }

  async function onDebugAnalyze() {
    const buffer = audioEngine.getAudioBuffer()
    if (!buffer) {
      console.warn('[debug] нет загруженного трека')
      return
    }
    const result = await testOfflineAnalyzer(buffer)
    const beatCount = result.beats.filter(Boolean).length
    console.log('[debug] fps:', result.fps)
    console.log('[debug] totalFrames:', result.totalFrames)
    console.log('[debug] кадров с битом:', beatCount)
  }

  async function onProfileAll() {
    if (profilingRunning.current) return
    profilingRunning.current = true
    audioEngine.stop()

    const results: Record<string, VibeProfile> = {}
    const total = VIZ_ITEMS.length

    const driver = async (frame: ProfilerFrame) => {
      const s = useAudioStore.getState()
      s.setAudioData(frame.audioData)
      s.setEnergy(frame.energy)
      s.setBeat(frame.beat)
      s.setIsPlaying(true)
      await tickFrame(1000 / 60)
    }

    try {
      for (let idx = 0; idx < VIZ_ITEMS.length; idx++) {
        const item = VIZ_ITEMS[idx]
        setProfilingProgress({ current: idx, total, label: item.label })

        const s0 = useAudioStore.getState()
        s0.setAudioData(new Float32Array(1024))
        s0.setEnergy(0)
        s0.setBeat(false)
        s0.setIsPlaying(false)

        const wrapper = document.createElement('div')
        wrapper.style.cssText = 'position:fixed;inset:0;opacity:0;pointer-events:none;z-index:-10;'
        document.body.appendChild(wrapper)
        const root = createRoot(wrapper)
        root.render(renderVisualizer(item.key as VisualizerMode))

        await new Promise<void>((r) => setTimeout(r, 120))

        installShim()
        try {
          await new Promise<void>((r) => setTimeout(r, 60))
          const canvas = wrapper.querySelector('canvas') as HTMLCanvasElement | null
          if (!canvas) {
            console.warn(`[profiler] canvas не найден для ${item.key}`)
            continue
          }
          try {
            const profile = await profileVisualizer(item.key, canvas, driver)
            console.log(`[profiler] ${item.key}:`, profile)
            setCachedProfile(item.key, profile)
            results[item.key] = profile
          } catch (err) {
            console.error(`[profiler] ${item.key} упал:`, err)
          }
        } finally {
          uninstallShim()
          root.unmount()
          wrapper.remove()
        }

        await new Promise<void>((r) => setTimeout(r, 40))
      }

      const sEnd = useAudioStore.getState()
      sEnd.setIsPlaying(false)
      sEnd.setAudioData(new Float32Array())
      sEnd.setEnergy(0)
      sEnd.setBeat(false)
    } finally {
      profilingRunning.current = false
      setProfilingProgress(null)
      setNeedsVisualizerProfiling(false)
    }
  }

  async function runExport(settings: ExportSettings) {
    const buffer = audioEngine.getAudioBuffer()
    if (!buffer) {
      console.warn('[export] нет загруженного трека')
      return
    }
    const audioBytes = audioEngine.getOriginalAudioBytes()
    if (!audioBytes) {
      console.warn('[export] нет исходных байт аудио')
      return
    }
    const audioExt = audioEngine.getOriginalAudioExt()
    const { width, height, fps } = settings

    const { trackInfo } = useAudioStore.getState()
    const baseName = (trackInfo.title || 'visualization').replace(/[\\/:*?"<>|]/g, '_')

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

    exportCancelled.current = false
    const startedAt = Date.now()
    setExportProgress({ current: 0, total: 1, startedAt })

    const work = WORK_SIZES[settings.aspect]
    const win = getCurrentWindow()
    const scaleFactor = await win.scaleFactor()
    const prevSize = await win.innerSize()
    const prevLogical = prevSize.toLogical(scaleFactor)
    let resized = false
    try {
      await win.setSize(new LogicalSize(work.w, work.h))
      resized = true
      await new Promise((r) => setTimeout(r, 400))

      await runRecording({
        audioBuffer: buffer,
        fps,
        width,
        height,
        audioBytes,
        audioExtension: audioExt,
        outputPath: path,
        onProgress: (f, total) => {
          if (exportCancelled.current) return
          setExportProgress({ current: f, total, startedAt })
        },
      })
    } catch (err) {
      console.error('[export] упал:', err)
      const msg = String(err)
      if (msg.includes('ffmpeg не запустился') || msg.toLowerCase().includes('no such file')) {
        alert('Требуется ffmpeg. Установите: brew install ffmpeg (Mac) или скачайте с ffmpeg.org (Windows)')
}}}}
