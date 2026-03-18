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
      { label: '720p', sub: '720×720', width: 720, height: 720, perFrameMs: 25 },
      { label: '1080p', sub: '1080×1080', width: 1080, height: 1080, perFrameMs: 45 },
      { label: '1440p', sub: '1440×1440', width: 1440, height: 1440, perFrameMs: 80 },
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

export function ExportModal({ isOpen, onClose, onStart, trackDurationSec }: ExportModalProps) {
  const [aspectIdx, setAspectIdx] = useState(0)
  const [resIdx, setResIdx] = useState(ASPECTS[0].defaultIdx)
  const [fps, setFps] = useState(60)

  const aspect = ASPECTS[aspectIdx]
  const resolution = aspect.resolutions[resIdx] ?? aspect.resolutions[aspect.defaultIdx]

  const estimatedSec = useMemo(() => {
    if (trackDurationSec <= 0) return 0
    const frames = trackDurationSec * fps
    return Math.round((frames * resolution.perFrameMs) / 1000)
  }, [trackDurationSec, fps, resolution])

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
        <p className="export-modal__sub">{`Длительность трека: ${formatTime(trackDurationSec)} · оценка рендера: ${formatEstimate(estimatedSec)}`}</p>

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
