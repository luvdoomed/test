import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { MOOD_ORDER, MOOD_LABELS, type MoodId } from '../../audio/moodEngine'
import { compileUserViz } from '../../userViz/compiler'
import { useUserVizStore } from '../../userViz/userVizStore'

interface UserVizUploadModalProps {
  file: File
  onClose: () => void
  onUploaded: (vizId: string) => void
}

type CompileState =
  | { kind: 'pending' }
  | { kind: 'ok' }
  | { kind: 'error'; message: string }

function fileNameWithoutExt(name: string): string {
  return name.replace(/\.[^/.]+$/, '')
}

export default function UserVizUploadModal({ file, onClose, onUploaded }: UserVizUploadModalProps) {
  const [name, setName] = useState(() => fileNameWithoutExt(file.name))
  const [moods, setMoods] = useState<Set<MoodId>>(new Set())
  const [compile, setCompile] = useState<CompileState>({ kind: 'pending' })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const addVisualizer = useUserVizStore((s) => s.addVisualizer)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const source = await file.text()
        const result = compileUserViz(source)
        if (cancelled) return
        if (result.component) setCompile({ kind: 'ok' })
        else setCompile({ kind: 'error', message: result.error ?? 'Неизвестная ошибка' })
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        setCompile({ kind: 'error', message: msg })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [file])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function toggleMood(mood: MoodId) {
    setMoods((prev) => {
      const next = new Set(prev)
      if (next.has(mood)) next.delete(mood)
      else next.add(mood)
      return next
    })
  }

  const canSubmit = useMemo(() => {
    return (
      compile.kind === 'ok' &&
      name.trim().length > 0 &&
      moods.size > 0 &&
      !submitting
    )
  }, [compile, name, moods, submitting])

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const runtime = await addVisualizer(file, name, Array.from(moods))
      onUploaded(runtime.id)
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSubmitError(msg)
      setSubmitting(false)
    }
  }

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        animation: 'uvModalFade 0.18s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '86vh',
          background: 'var(--bg)',
          borderRadius: 18,
          border: '1px solid var(--border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'uvModalSlide 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--fg-mute)',
                marginBottom: 4,
              }}
            >
              Новый визуализатор
            </div>
            <div
              className="truncate"
              style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--fg)' }}
            >
              {file.name}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-soft)',
              color: 'var(--fg-mute)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div
          style={{
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            overflowY: 'auto',
          }}
        >
          <CompileStatusBanner state={compile} />

          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--fg-mute)',
              }}
            >
              Название
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-soft)',
                color: 'var(--fg)',
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-active)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            />
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--fg-mute)',
              }}
            >
              Настроения · хотя бы одно
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {MOOD_ORDER.map((m) => {
                const checked = moods.has(m)
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMood(m)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 999,
                      border: `1px solid ${checked ? 'var(--border-active)' : 'var(--border)'}`,
                      background: checked ? 'var(--bg-elev)' : 'var(--bg-soft)',
                      color: checked ? 'var(--fg)' : 'var(--fg-soft)',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'color 0.15s, border-color 0.15s, background 0.15s',
                    }}
                  >
                    {MOOD_LABELS[m]}
                  </button>
                )
              })}
            </div>
          </div>

          {submitError ? (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: 'rgb(252, 165, 165)',
                fontSize: 12,
              }}
            >
              {submitError}
            </div>
          ) : null}
        </div>

        <div
          style={{
            padding: '14px 24px 18px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--fg-soft)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            style={{
              padding: '9px 18px',
              borderRadius: 8,
              border: 'none',
              background: canSubmit ? 'var(--fg)' : 'var(--bg-elev)',
              color: canSubmit ? 'var(--bg)' : 'var(--fg-mute)',
              fontSize: 13,
              fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {submitting ? 'Загрузка...' : 'Загрузить'}
          </button>
        </div>

        <style>{`
          @keyframes uvModalFade { from { opacity: 0 } to { opacity: 1 } }
          @keyframes uvModalSlide {
            from { opacity: 0; transform: translateY(8px) scale(0.98) }
            to { opacity: 1; transform: translateY(0) scale(1) }
          }
        `}</style>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

function CompileStatusBanner({ state }: { state: CompileState }) {
  if (state.kind === 'pending') {
    return (
      <div
        style={{
          padding: '10px 12px',
          borderRadius: 8,
          background: 'var(--bg-soft)',
          border: '1px solid var(--border)',
          color: 'var(--fg-mute)',
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Loader2 size={14} style={{ animation: 'uvSpin 0.9s linear infinite' }} />
        Компилирую...
        <style>{`@keyframes uvSpin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }
  if (state.kind === 'ok') {
    return (
      <div
        style={{
          padding: '10px 12px',
          borderRadius: 8,
          background: 'rgba(34, 197, 94, 0.12)',
          border: '1px solid rgba(34, 197, 94, 0.35)',
          color: 'rgb(134, 239, 172)',
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <CheckCircle2 size={14} />
        Код скомпилирован
      </div>
    )
  }
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        background: 'rgba(239, 68, 68, 0.12)',
        border: '1px solid rgba(239, 68, 68, 0.35)',
        color: 'rgb(252, 165, 165)',
        fontSize: 12,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
      }}
    >
      <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
      <div style={{ wordBreak: 'break-word', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
        {state.message}
      </div>
    </div>
  )
}
