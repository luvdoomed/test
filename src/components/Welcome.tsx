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

  const klass = ['welcome__card', dragging || hover ? 'welcome__card--drag' : ''].filter(Boolean).join(' ')

  return (
    <div className="welcome" aria-label="Загрузить трек">
      <div
        className={klass}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <div className="welcome__icon" aria-hidden="true">♪</div>
        <div className="welcome__title">Перетащи трек сюда</div>
        <div className="welcome__hint">
          MP3 · FLAC · WAV или нажми, чтобы выбрать
          <br />
          можно сразу выбрать аудио и .lrc файл
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,.flac,.wav,.lrc,text/plain"
          multiple
          className="hidden-input"
          onChange={onChange}
        />
      </div>
    </div>
  )
}
