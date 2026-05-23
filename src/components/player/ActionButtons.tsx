import { type ReactNode } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useHover } from '../../utils/useHover'

interface ActionButtonsProps {
  hasTrack: boolean
  onOpenParams: () => void
}

export default function ActionButtons({ hasTrack: _hasTrack, onOpenParams }: ActionButtonsProps) {
  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 8 }}>
      <ActionBtn icon={<SlidersHorizontal size={14} />} label="Параметры" onClick={onOpenParams} />
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
  const { hover, bind } = useHover()
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
      {...bind}
      className="t-button"
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
        fontFamily: 'inherit',
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
