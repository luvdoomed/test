import { useState, type ReactNode } from 'react'
import { SlidersHorizontal, Mic2, Download } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useAudioStore } from '../../store/audioStore'

interface ActionButtonsProps {
  hasTrack: boolean
  onOpenParams: () => void
}

export default function ActionButtons({ hasTrack, onOpenParams }: ActionButtonsProps) {
  const setExportOpen = useUIStore((s) => s.setExportOpen)
  const setSelectedVizId = useUIStore((s) => s.setSelectedVizId)
  const audioMode = useAudioStore((s) => s.audioMode)

  const systemMode = audioMode === 'system'
  const exportDisabled = !hasTrack || systemMode
  const karaokeDisabled = !hasTrack || systemMode

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
      <ActionBtn icon={<SlidersHorizontal size={14} />} label="Параметры" onClick={onOpenParams} />
      <ActionBtn
        icon={<Mic2 size={14} />}
        label="Караоке"
        disabled={karaokeDisabled}
        title={systemMode ? 'Доступно только для файлов' : undefined}
        onClick={() => setSelectedVizId('karaoke')}
      />
      <ActionBtn
        icon={<Download size={14} />}
        label="Экспорт"
        disabled={exportDisabled}
        title={systemMode ? 'Запись доступна только для файлов' : undefined}
        onClick={() => setExportOpen(true)}
      />
    </div>
  )
}

interface ActionBtnProps {
  icon: ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  title?: string
  onClick: () => void
}

function ActionBtn({ icon, label, active = false, disabled = false, title, onClick }: ActionBtnProps) {
  const [hover, setHover] = useState(false)
  let bg = 'var(--bg-soft)'
  let color = 'var(--fg-soft)'
  let border = 'var(--border)'
  if (active) {
    bg = 'var(--bg-elev)'
    color = 'var(--fg)'
    border = 'var(--border-active)'
  } else if (hover && !disabled) {
    color = 'var(--fg)'
    border = 'var(--border-active)'
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        border: `1px solid ${border}`,
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'color 0.15s, border-color 0.15s, background 0.15s',
        fontFamily: 'inherit',
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
