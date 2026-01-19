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
