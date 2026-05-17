import { useState } from 'react'

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
      { label: '720p', sub: '1280×720', width: 1280, height: 720 },
      { label: '1080p', sub: '1920×1080', width: 1920, height: 1080 },
      { label: '1440p', sub: '2560×1440', width: 2560, height: 1440 },
    ],
  },
  {
    key: '9:16',
    title: '9:16',
    caption: 'Вертикальное · Reels, TikTok',
    defaultIdx: 1,
    resolutions: [
      { label: '720p', sub: '720×1280', width: 720, height: 1280 },
      { label: '1080p', sub: '1080×1920', width: 1080, height: 1920 },
      { label: '1440p', sub: '1440×2560', width: 1440, height: 2560 },
    ],
  },
  {
    key: '1:1',
    title: '1:1',
    caption: 'Квадрат · Instagram',
    defaultIdx: 1,
    resolutions: [
      { label: '720p', sub: '720×720', width: 720, height: 720 },
      { label: '1080p', sub: '1080×1080', width: 1080, height: 1080 },
      { label: '1440p', sub: '1440×1440', width: 1440, height: 1440 },
    ],
  },
]

const FPS_OPTIONS = [30, 60]

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  onStart: (settings: ExportSettings) => void
  trackDurationSec: number
}

export function ExportModal({ isOpen, onClose, onStart }: ExportModalProps) {
  const [aspectIdx, setAspectIdx] = useState(0)
  const [resIdx, setResIdx] = useState(ASPECTS[0].defaultIdx)
  const [fps, setFps] = useState(60)

  const aspect = ASPECTS[aspectIdx]
  const resolution = aspect.resolutions[resIdx] ?? aspect.resolutions[aspect.defaultIdx]

  if (!isOpen) return null

  function pickAspect(i: number) {
    setAspectIdx(i)
    setResIdx(ASPECTS[i].defaultIdx)
  }

  function start() {
    onStart({
      width: resolution.width,
      height: resolution.height,
      fps,
      aspect: aspect.key,
    })
  }

  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card export-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="export-modal__title">Экспорт видео</h2>

        <div className="export-modal__group">
          <div className="export-modal__group-title">Пропорция</div>
          <div className="export-modal__opts">
            {ASPECTS.map((a, i) => (
              <button
                key={a.key}
                type="button"
                className={`opt-btn${i === aspectIdx ? ' opt-btn--active' : ''}`}
                onClick={() => pickAspect(i)}
                title={a.caption}
              >
                {a.title}
              </button>
            ))}
          </div>
        </div>

        <div className="export-modal__group">
          <div className="export-modal__group-title">{`Разрешение · ${aspect.caption}`}</div>
          <div className="export-modal__opts">
            {aspect.resolutions.map((r, i) => (
              <button
                key={r.label}
                type="button"
                className={`opt-btn${i === resIdx ? ' opt-btn--active' : ''}`}
                onClick={() => setResIdx(i)}
              >
                {r.label} · {r.sub}
              </button>
            ))}
          </div>
        </div>

        <div className="export-modal__group">
          <div className="export-modal__group-title">FPS</div>
          <div className="export-modal__opts">
            {FPS_OPTIONS.map((f) => (
              <button
                key={f}
                type="button"
                className={`opt-btn${f === fps ? ' opt-btn--active' : ''}`}
                onClick={() => setFps(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="export-modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn btn--primary" onClick={start}>
            Начать рендер
          </button>
        </div>
      </div>
    </div>
  )
}

interface ExportProgressOverlayProps {
  current: number
  total: number
  startedAt: number
  onCancel: () => void
}

export function ExportProgressOverlay({ current, total, startedAt, onCancel }: ExportProgressOverlayProps) {
  const pct = total > 0 ? Math.floor((current / total) * 100) : 0
  const elapsedSec = Math.floor((Date.now() - startedAt) / 1000)
  const m = Math.floor(elapsedSec / 60)
  const s = elapsedSec % 60

  return (
    <div className="overlay">
      <div className="modal-card export-modal">
        <h2 className="export-modal__title">Рендер идёт</h2>
        <div className="export-modal__progress">
          <div className="export-modal__progress-text">
            <span>{`Кадр ${current} / ${total}`}</span>
            <span>{`${m}м ${s}с`}</span>
          </div>
          <div className="export-modal__progress-bar">
            <div className="export-modal__progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="export-modal__progress-text">
            <span>{`${pct}%`}</span>
          </div>
        </div>
        <div className="export-modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

