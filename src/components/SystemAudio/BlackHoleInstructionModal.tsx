import { useState } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'

interface BlackHoleInstructionModalProps {
  isOpen: boolean
  onClose: () => void
}

const BREW_CMD = 'brew install blackhole-2ch'
const BLACKHOLE_URL = 'https://existential.audio/blackhole/'

export default function BlackHoleInstructionModal({
  isOpen,
  onClose,
}: BlackHoleInstructionModalProps) {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  async function copyCmd() {
    try {
      await navigator.clipboard.writeText(BREW_CMD)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.warn('[blackhole-modal] copy failed:', err)
    }
  }

  async function openSite() {
    try {
      await openUrl(BLACKHOLE_URL)
    } catch (err) {
      console.error('[blackhole-modal] не удалось открыть сайт:', err)
    }
  }

  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h2 className="export-modal__title">Нужен BlackHole</h2>

        <p
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--fg-soft)',
            marginBottom: 14,
          }}
        >
          Для прослушивания системного звука на Mac нужен виртуальный
          аудиодрайвер <strong style={{ color: 'var(--fg)' }}>BlackHole</strong>. Это
          бесплатное open-source решение, которое перенаправляет звук
          с приложений (Spotify, YouTube) на вход, который читает Loomi.
        </p>

        <div className="export-modal__group-title">Установка</div>

        <div className="blackhole-code-block">
          <span>{BREW_CMD}</span>
          <button type="button" className="blackhole-copy-btn" onClick={copyCmd}>
            {copied ? 'скопировано' : 'копировать'}
          </button>
        </div>

        <ol
          style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            fontSize: 13,
            lineHeight: 1.55,
            color: 'var(--fg-soft)',
          }}
        >
          <Step n={1}>
            Установи BlackHole (команда выше или загрузка с сайта)
          </Step>
          <Step n={2}>Перезагрузи Mac</Step>
          <Step n={3}>
            Открой <strong style={{ color: 'var(--fg)' }}>Audio MIDI Setup</strong> и
            создай <strong style={{ color: 'var(--fg)' }}>Multi-Output Device</strong> —
            отметь свои колонки и BlackHole 2ch
          </Step>
          <Step n={4}>
            Установи этот Multi-Output Device как системный Output в настройках звука
          </Step>
        </ol>

        <div className="export-modal__actions" style={{ marginTop: 22 }}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Закрыть
          </button>
          <button type="button" className="btn btn--primary" onClick={openSite}>
            Открыть сайт BlackHole
          </button>
        </div>
      </div>
    </div>
  )
}

interface StepProps {
  n: number
  children: React.ReactNode
}

function Step({ n, children }: StepProps) {
  return (
    <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span
        style={{
          flex: '0 0 22px',
          width: 22,
          height: 22,
          borderRadius: 999,
          background: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          color: 'var(--fg)',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        {n}
      </span>
      <span>{children}</span>
    </li>
  )
}
