import { type ChangeEvent, useRef, useState } from 'react'

interface WelcomeProps {
  dragging: boolean
  onPickAudio: (file: File) => void
}

export function Welcome({ dragging, onPickAudio }: WelcomeProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [hover, setHover] = useState(false)

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onPickAudio(file)
    e.target.value = ''
  }
}
