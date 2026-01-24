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
}
