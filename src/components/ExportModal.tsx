import { useMemo, useState } from 'react'

export type AspectKey = '16:9' | '9:16' | '1:1'

export interface ExportSettings {
  width: number
  height: number
  fps: number
  aspect: AspectKey
}

interface Resolution {
  label: string
  sub: string
  width: number
  height: number
  perFrameMs: number
}

interface AspectOption {
  key: AspectKey
  title: string
  caption: string
  resolutions: Resolution[]
  defaultIdx: number
}

const ASPECTS: AspectOption[] = [
  {
    key: '16:9',
    title: '16:9',
    caption: 'Горизонтальное · YouTube',
    defaultIdx: 1,
    resolutions: [
      { label: '720p', sub: '1280×720', width: 1280, height: 720, perFrameMs: 30 },
      { label: '1080p', sub: '1920×1080', width: 1920, height: 1080, perFrameMs: 55 },
      { label: '1440p', sub: '2560×1440', width: 2560, height: 1440, perFrameMs: 100 },
    ],
  },
  {
    key: '9:16',
    title: '9:16',
    caption: 'Вертикальное · Reels, TikTok',
    defaultIdx: 1,
    resolutions: [
      { label: '720p', sub: '720×1280', width: 720, height: 1280, perFrameMs: 30 },
      { label: '1080p', sub: '1080×1920', width: 1080, height: 1920, perFrameMs: 55 },
      { label: '1440p', sub: '1440×2560', width: 1440, height: 2560, perFrameMs: 100 },
    ],
  },
  {
    key: '1:1',
    title: '1:1',
    caption: 'Квадрат · Instagram',
    defaultIdx: 1,
    resolutions: [
}
]]
