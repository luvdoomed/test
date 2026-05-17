import { type ChangeEvent, type DragEvent, useRef, useState } from 'react'
import { Music } from 'lucide-react'
import { audioEngine } from '../../audio/audioEngine'
import { useLibraryStore } from '../../store/libraryStore'
import { loadTrack } from '../../library/playback'

const ACCEPTED_EXT = ['.mp3', '.flac', '.wav']

function isAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) return true
  const name = file.name.toLowerCase()
  return ACCEPTED_EXT.some((ext) => name.endsWith(ext))
}

async function loadAndPlay(file: File) {
  const lib = useLibraryStore.getState()
  const track = await lib.addTrack(file)
  await loadTrack(track)
  audioEngine.play()
  lib.setCurrentTrack(track.id)
}

export default function TrackDropZone() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [hover, setHover] = useState(false)

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void loadAndPlay(file)
    e.target.value = ''
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setHover(true)
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setHover(false)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setHover(false)
    const file = Array.from(e.dataTransfer.files).find(isAudioFile)
    if (file) void loadAndPlay(file)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        width: '100%',
        padding: 24,
        borderRadius: 12,
        border: `1px dashed ${hover ? 'var(--border-active)' : 'var(--border-strong)'}`,
        background: hover ? 'var(--bg-elev)' : 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
        outline: 'none',
      }}
    >
      <Music size={20} style={{ color: 'var(--fg-mute)' }} />
      <div style={{ fontSize: 14, color: 'var(--fg-soft)' }}>Перетащи MP3 сюда</div>
      <div style={{ fontSize: 12, color: 'var(--fg-mute)' }}>или нажми, чтобы выбрать</div>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        onChange={onPick}
        style={{ display: 'none' }}
      />
    </div>
  )
}
