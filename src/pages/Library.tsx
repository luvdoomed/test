import { type ChangeEvent, type DragEvent, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutGrid, Rows3, Plus, Trash2 } from 'lucide-react'
import { useUIStore } from '../store/uiStore'
import { useSettingsStore } from '../store/settingsStore'
import { useLibraryStore, type LibraryTrack } from '../store/libraryStore'
import { useAudioStore } from '../store/audioStore'
import { resetMoodPicker } from '../audio/moodEngine'
import { audioEngine } from '../audio/audioEngine'
import { autoPlayIfLyricsReady, loadTrack } from '../library/playback'
import TrackListItem from '../components/library/TrackListItem'
import TrackGridCard from '../components/library/TrackGridCard'
import EmptyLibrary from '../components/library/EmptyLibrary'
import { pluralTrack } from '../utils/plural'
import { useAuthStore } from '../store/authStore'
import { trackNeedsLocalFile } from '../utils/trackCloud'
import {
  downloadCloudAudioToDevice,
  uploadLocalAudioToCloud,
} from '../services/cloudTrackAudio'

const ACCEPTED_EXT = ['.mp3', '.flac', '.wav']

function isAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) return true
  const name = file.name.toLowerCase()
  return ACCEPTED_EXT.some((ext) => name.endsWith(ext))
}

export default function Library() {
  const tracks = useLibraryStore((s) => s.tracks)
  const currentTrackId = useLibraryStore((s) => s.currentTrackId)
  const addTrack = useLibraryStore((s) => s.addTrack)
  const removeTrack = useLibraryStore((s) => s.removeTrack)
  const removeTracks = useLibraryStore((s) => s.removeTracks)

  const isPlaying = useAudioStore((s) => s.isPlaying)

  const view = useSettingsStore((s) => s.libraryView)
  const setView = useSettingsStore((s) => s.setLibraryView)
  const searchQuery = useUIStore((s) => s.searchQuery)

  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const dragCounter = useRef(0)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [uploadHint, setUploadHint] = useState<string | null>(null)
  const [cloudBusyId, setCloudBusyId] = useState<string | null>(null)
  const loggedIn = useAuthStore((s) => Boolean(s.token))
  const cloudAudioTrackIds = useAuthStore((s) => s.cloudAudioTrackIds)

  useEffect(() => {
    if (!uploadHint) return
    const t = window.setTimeout(() => setUploadHint(null), 4500)
    return () => clearTimeout(t)
  }, [uploadHint])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return tracks
    return tracks.filter(
      (t) => t.name.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q),
    )
  }, [tracks, searchQuery])

  useEffect(() => {
    const valid = new Set(tracks.map((t) => t.id))
    setSelectedIds((prev) => {
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (valid.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [tracks])

  useEffect(() => {
    if (tracks.length === 0 && selectionMode) {
      setSelectionMode(false)
      setSelectedIds(new Set())
    }
  }, [tracks.length, selectionMode])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAllFiltered = useCallback(() => {
    setSelectedIds(new Set(filtered.map((t) => t.id)))
  }, [filtered])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }, [])

  async function bulkDelete() {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    const ok = window.confirm(`Удалить выбранные треки (${ids.length})?`)
    if (!ok) return
    await removeTracks(ids)
    setSelectedIds(new Set())
  }

  async function ingest(files: File[]) {
    const audio = files.filter(isAudioFile)
    if (audio.length === 0) return
    let dupCount = 0
    for (const f of audio) {
      try {
        const r = await addTrack(f)
        if (!r.added) dupCount++
        else if (r.linkedCloudSlot) setUploadHint('Файл привязан к треку из облака')
      } catch (err) {
        console.error('[library] не удалось добавить:', f.name, err)
      }
    }
    if (dupCount > 0) {
      const msg =
        dupCount === 1 && audio.length === 1
          ? 'Трек уже добавлен в библиотеку'
          : dupCount === audio.length
            ? 'Эти файлы уже есть в библиотеке'
            : `Не добавлено повторов: ${dupCount} из ${audio.length}`
      setUploadHint(msg)
    }
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? [])
    void ingest(list)
    e.target.value = ''
  }

  function onDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    dragCounter.current++
    if (e.dataTransfer.types.includes('Files')) setDragOver(true)
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setDragOver(false)
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    dragCounter.current = 0
    setDragOver(false)
    const list = Array.from(e.dataTransfer.files)
    void ingest(list)
  }

  async function playTrack(track: LibraryTrack) {
    const lib = useLibraryStore.getState()
    const audio = useAudioStore.getState()
    if (track.id === lib.currentTrackId) {
      if (audio.trackPrepareBusy) return
      if (audio.isPlaying) audioEngine.pause()
      else audioEngine.play()
      return
    }
    audio.clearPlaylistQueue()
    resetMoodPicker()
    try {
      await loadTrack(track)
      autoPlayIfLyricsReady()
      lib.setCurrentTrack(track.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setUploadHint(msg)
    }
  }

  async function cloudDownload(trackId: string) {
    setCloudBusyId(trackId)
    try {
      await downloadCloudAudioToDevice(trackId)
      setUploadHint('Аудио скачано из облака')
    } catch (err) {
      setUploadHint(err instanceof Error ? err.message : String(err))
    } finally {
      setCloudBusyId(null)
    }
  }

  async function cloudUpload(trackId: string) {
    setCloudBusyId(trackId)
    try {
      await uploadLocalAudioToCloud(trackId)
      setUploadHint('Аудио прикреплено к облаку')
    } catch (err) {
      setUploadHint(err instanceof Error ? err.message : String(err))
    } finally {
      setCloudBusyId(null)
    }
  }

  const subtitle = tracks.length === 0
    ? 'Пока пусто'
    : `${tracks.length} ${pluralTrack(tracks.length)} загружено`

  return (
    <main
      className="mx-auto max-w-[1400px] px-8 pt-16 pb-32 relative z-[2]"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex items-start justify-between gap-8 mb-10">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--fg-mute)] mb-4">
            — Твои треки
          </div>
          <h1 className="text-5xl sm:text-6xl font-semibold tracking-[-0.035em] leading-[1.02] mb-4">
            Музыка,{' '}
            <span
              className="font-normal italic"
              style={{
                fontFamily: "'Instrument Serif', serif",
                backgroundImage: 'linear-gradient(180deg, var(--fg) 0%, var(--fg-mute) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              которую слушаешь.
            </span>
          </h1>
          <p className="text-base text-[var(--fg-soft)]">{subtitle}</p>
          {uploadHint ? (
            <p className="mt-3 text-sm max-w-xl" role="status" style={{ color: 'var(--fg-mute)' }}>
              {uploadHint}
            </p>
          ) : null}
          {selectionMode && tracks.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 mt-5">
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={() => void bulkDelete()}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid rgba(239, 68, 68, 0.45)',
                  background: selectedIds.size === 0 ? 'var(--bg-soft)' : 'rgba(239, 68, 68, 0.12)',
                  color: 'var(--fg)',
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer',
                  opacity: selectedIds.size === 0 ? 0.5 : 1,
                  fontFamily: 'inherit',
                }}
              >
                <Trash2 size={14} />
                Удалить ({selectedIds.size})
              </button>
              <button
                type="button"
                disabled={filtered.length === 0}
                onClick={selectAllFiltered}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-soft)',
                  color: 'var(--fg)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: filtered.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: filtered.length === 0 ? 0.5 : 1,
                  fontFamily: 'inherit',
                }}
              >
                Все на экране
              </button>
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={clearSelection}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--fg-soft)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer',
                  opacity: selectedIds.size === 0 ? 0.45 : 1,
                  fontFamily: 'inherit',
                }}
              >
                Снять выбор
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            disabled={tracks.length === 0}
            onClick={() => {
              if (selectionMode) exitSelectionMode()
              else setSelectionMode(true)
            }}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: selectionMode ? 'var(--bg-elev)' : 'var(--bg-soft)',
              color: 'var(--fg)',
              fontSize: 13,
              fontWeight: 500,
              cursor: tracks.length === 0 ? 'not-allowed' : 'pointer',
              opacity: tracks.length === 0 ? 0.45 : 1,
              fontFamily: 'inherit',
            }}
          >
            {selectionMode ? 'Готово' : 'Выбрать'}
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-soft)',
              color: 'var(--fg)',
              fontSize: 13,
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <Plus size={14} />
            Добавить
          </button>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={onPick}
        style={{ display: 'none' }}
      />

      {tracks.length === 0 ? (
        <EmptyLibrary onPick={() => inputRef.current?.click()} />
      ) : filtered.length === 0 ? (
        <div
          className="flex items-center justify-center"
          style={{ minHeight: 240, color: 'var(--fg-mute)', fontSize: 14 }}
        >
          Ничего не нашлось
        </div>
      ) : view === 'list' ? (
        <motion.div layout className="flex flex-col" style={{ gap: 4 }}>
          <AnimatePresence initial={false}>
            {filtered.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
              >
                <TrackListItem
                  track={t}
                  isActive={t.id === currentTrackId}
                  isPlaying={isPlaying && t.id === currentTrackId}
                  onPlay={() => void playTrack(t)}
                  onRemove={() => removeTrack(t.id)}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(t.id)}
                  onToggleSelect={() => toggleSelect(t.id)}
                  needsLocalFile={trackNeedsLocalFile(t)}
                  hasCloudAudio={cloudAudioTrackIds.includes(t.id)}
                  cloudBusy={cloudBusyId === t.id}
                  onCloudDownload={
                    loggedIn && trackNeedsLocalFile(t) && cloudAudioTrackIds.includes(t.id)
                      ? () => void cloudDownload(t.id)
                      : undefined
                  }
                  onCloudUpload={
                    loggedIn && !trackNeedsLocalFile(t) && !cloudAudioTrackIds.includes(t.id)
                      ? () => void cloudUpload(t.id)
                      : undefined
                  }
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div
          layout
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {filtered.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.25 }}
              >
                <TrackGridCard
                  track={t}
                  isActive={t.id === currentTrackId}
                  isPlaying={isPlaying && t.id === currentTrackId}
                  onPlay={() => void playTrack(t)}
                  onRemove={() => removeTrack(t.id)}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(t.id)}
                  onToggleSelect={() => toggleSelect(t.id)}
                  needsLocalFile={trackNeedsLocalFile(t)}
                  hasCloudAudio={cloudAudioTrackIds.includes(t.id)}
                  cloudBusy={cloudBusyId === t.id}
                  onCloudDownload={
                    loggedIn && trackNeedsLocalFile(t) && cloudAudioTrackIds.includes(t.id)
                      ? () => void cloudDownload(t.id)
                      : undefined
                  }
                  onCloudUpload={
                    loggedIn && !trackNeedsLocalFile(t) && !cloudAudioTrackIds.includes(t.id)
                      ? () => void cloudUpload(t.id)
                      : undefined
                  }
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence>
        {dragOver ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[40] flex items-center justify-center pointer-events-none"
            style={{
              background: 'color-mix(in srgb, var(--bg) 85%, transparent)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div
              style={{
                padding: '40px 64px',
                borderRadius: 20,
                border: '2px dashed var(--border-active)',
                color: 'var(--fg)',
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                background: 'var(--bg-soft)',
              }}
            >
              Перетащи MP3 сюда
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  )
}

interface ViewToggleProps {
  view: 'list' | 'grid'
  onChange: (v: 'list' | 'grid') => void
}

function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div
      className="inline-flex items-center"
      style={{
        background: 'var(--bg-soft)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: 3,
        gap: 2,
      }}
    >
      <Btn active={view === 'list'} onClick={() => onChange('list')} title="Список">
        <Rows3 size={14} />
      </Btn>
      <Btn active={view === 'grid'} onClick={() => onChange('grid')} title="Сетка">
        <LayoutGrid size={14} />
      </Btn>
    </div>
  )
}

function Btn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 30,
        height: 28,
        borderRadius: 7,
        border: 'none',
        background: active ? 'var(--bg-elev)' : 'transparent',
        color: active ? 'var(--fg)' : 'var(--fg-mute)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {children}
    </button>
  )
}
