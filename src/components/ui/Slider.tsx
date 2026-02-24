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
}
