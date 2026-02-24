import * as Slider from '@radix-ui/react-slider'
import './Slider.css'

interface CustomSliderProps {
  value: number
  onValueChange: (v: number) => void
  className?: string
  ariaLabel?: string
  variant?: 'progress' | 'volume'
}

export function CustomSlider({
  value,
  onValueChange,
  className = '',
  ariaLabel,
  variant = 'progress',
}: CustomSliderProps) {
  const safe = clamp01(value)
  const klass = ['slider-root', variant === 'volume' ? 'volume' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <Slider.Root
      className={klass}
      value={[safe * 100]}
      onValueChange={([v]) => onValueChange(v / 100)}
      max={100}
      step={0.1}
      aria-label={ariaLabel}
    >
      <Slider.Track className="slider-track">
        <Slider.Range className="slider-range" />
      </Slider.Track>
      <Slider.Thumb className="slider-thumb" />
    </Slider.Root>
  )
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(1, v))
}
