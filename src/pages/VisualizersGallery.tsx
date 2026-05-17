import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutGrid, Rows3, FileCode2 } from 'lucide-react'
import { useUIStore } from '../store/uiStore'
import { useAudioStore } from '../store/audioStore'
import { resetMoodPicker, MOOD_LABELS } from '../audio/moodEngine'
import { GALLERY } from '../gallery/registry'
import type { VizCategory } from '../gallery/types'
import { useUserVizStore } from '../userViz/userVizStore'
import type { UserVisualizerRuntime } from '../userViz/types'
import VisualizerCard from '../components/gallery/VisualizerCard'
import FilterChip from '../components/gallery/FilterChip'

type Filter = 'all' | 'user' | VizCategory
type ViewMode = 'grid' | 'list'

export default function VisualizersGallery() {
  const searchQuery = useUIStore((s) => s.searchQuery)
  const selectedVizId = useUIStore((s) => s.selectedVizId)
  const setSelectedVizId = useUIStore((s) => s.setSelectedVizId)
  const openOverlay = useUIStore((s) => s.openOverlay)

  const userVisualizers = useUserVizStore((s) => s.visualizers)

  const [filter, setFilter] = useState<Filter>('all')
  const [view, setView] = useState<ViewMode>('grid')

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: GALLERY.length + userVisualizers.length,
      user: userVisualizers.length,
      premium: 0,
      basic: 0,
      effects: 0,
      atmosphere: 0,
    }
    for (const v of GALLERY) c[v.category]++
    return c
  }, [userVisualizers])

  const filters: { key: Filter; label: string; premium?: boolean; hidden?: boolean }[] = [
    { key: 'all', label: 'Все' },
    { key: 'user', label: 'Мои', hidden: userVisualizers.length === 0 },
    { key: 'premium', label: 'Премиум', premium: true },
    { key: 'basic', label: 'Базовые' },
    { key: 'effects', label: 'Эффекты' },
    { key: 'atmosphere', label: 'Атмосфера' },
  ]
  const visibleFilters = filters.filter((f) => !f.hidden)

  const q = searchQuery.trim().toLowerCase()

  const filteredUser = useMemo(() => {
    if (filter !== 'all' && filter !== 'user') return []
    if (!q) return userVisualizers
    return userVisualizers.filter((v) => v.name.toLowerCase().includes(q))
  }, [filter, q, userVisualizers])

  const filteredBuiltin = useMemo(() => {
    if (filter === 'user') return []
    return GALLERY.filter((viz) => {
      if (filter !== 'all' && viz.category !== filter) return false
      if (!q) return true
      return viz.name.toLowerCase().includes(q) || viz.subcategory.toLowerCase().includes(q)
    })
  }, [filter, q])

  function handleSelect(id: string) {
    useAudioStore.getState().clearPlaylistQueue()
    resetMoodPicker()
    setSelectedVizId(id)
    openOverlay(id)
  }

  const totalShown = filteredUser.length + filteredBuiltin.length

  return (
    <main className="mx-auto max-w-[1400px] px-8 pt-16 pb-32 relative z-[2]">
      <div className="flex items-start justify-between gap-8 mb-10">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--fg-mute)] mb-4">
            — Библиотека визуализаторов
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
              которую видишь.
            </span>
          </h1>
          <p className="text-base text-[var(--fg-soft)] max-w-2xl">
            Визуализаторы, которые реагируют на музыку. Выбери, закинь трек, сними видео.
          </p>
        </div>

        <ViewToggle view={view} onChange={setView} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-8">
        {visibleFilters.map((f) => (
          <FilterChip
            key={f.key}
            active={filter === f.key}
            premium={f.premium}
            count={counts[f.key]}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </FilterChip>
        ))}
      </div>

      {totalShown === 0 ? (
        <div
          className="flex items-center justify-center"
          style={{ minHeight: 320, color: 'var(--fg-mute)', fontSize: 14 }}
        >
          Ничего не нашлось
        </div>
      ) : (
        <>
          {filteredUser.length > 0 ? (
            <motion.div
              layout
              className="grid gap-4"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                marginBottom: filteredBuiltin.length > 0 ? 24 : 0,
              }}
            >
              <AnimatePresence mode="popLayout">
                {filteredUser.map((u, i) => (
                  <motion.div
                    key={u.id}
                    layout
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.3 }}
                  >
                    <UserGalleryCard
                      runtime={u}
                      isActive={u.id === selectedVizId}
                      index={i}
                      onClick={() => handleSelect(u.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          ) : null}

          {filteredUser.length > 0 && filteredBuiltin.length > 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                margin: '24px 0 32px',
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: 'var(--border)',
                }}
              />
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--fg-mute)',
                }}
              >
                Встроенные
              </span>
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: 'var(--border)',
                }}
              />
            </div>
          ) : null}

          {filteredBuiltin.length > 0 ? (
            <motion.div
              layout
              className="grid gap-4"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
            >
              <AnimatePresence mode="popLayout">
                {filteredBuiltin.map((viz, i) => (
                  <motion.div
                    key={viz.id}
                    layout
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.3 }}
                  >
                    <VisualizerCard
                      viz={viz}
                      isActive={viz.id === selectedVizId}
                      index={i}
                      onClick={() => handleSelect(viz.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          ) : null}
        </>
      )}
    </main>
  )
}

interface UserGalleryCardProps {
  runtime: UserVisualizerRuntime
  isActive: boolean
  index: number
  onClick: () => void
}

function UserGalleryCard({ runtime, isActive, index, onClick }: UserGalleryCardProps) {
  const [hovered, setHovered] = useState(false)
  const broken = runtime.error !== null

  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      whileTap={{ y: -2 }}
      className="relative aspect-[4/3] w-full overflow-hidden rounded-[14px] text-left"
      style={{
        background: broken
          ? 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(0,0,0,0.5))'
          : 'linear-gradient(135deg, var(--bg-elev), var(--bg-soft))',
        border: `1px solid ${isActive || hovered ? 'var(--border-active)' : 'var(--border)'}`,
        boxShadow: isActive
          ? '0 0 0 1px var(--border-active) inset, 0 18px 40px rgba(0,0,0,0.45)'
          : hovered
            ? '0 18px 40px rgba(0,0,0,0.45)'
            : '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'box-shadow 0.25s, border-color 0.2s',
        cursor: 'pointer',
        padding: 0,
        outline: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--fg-mute)',
        }}
      >
        <FileCode2 size={48} strokeWidth={1.2} />
      </div>

      <div
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          padding: '4px 8px',
          borderRadius: 6,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          fontWeight: 500,
          background: 'var(--bg-elev)',
          border: '1px solid var(--border-strong)',
          color: 'var(--fg)',
          backdropFilter: 'blur(8px)',
        }}
      >
        Свой
      </div>

      <div
        className="absolute inset-x-0 bottom-0"
        style={{ padding: 18, background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.55))' }}
      >
        <div
          className="flex items-center gap-1.5"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--fg-mute)',
            marginBottom: 6,
          }}
        >
          <span>{broken ? 'ошибка' : 'user'}</span>
          <span className="inline-block w-1 h-1 rounded-full bg-current opacity-60" />
          <span>{runtime.moods.map((m) => MOOD_LABELS[m]).join(', ') || '—'}</span>
        </div>
        <div
          className="truncate"
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: 'var(--fg)',
            letterSpacing: '-0.01em',
          }}
        >
          {runtime.name}
        </div>
      </div>
    </motion.button>
  )
}

interface ViewToggleProps {
  view: ViewMode
  onChange: (v: ViewMode) => void
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
      <ViewToggleBtn active={view === 'grid'} onClick={() => onChange('grid')} title="Сетка">
        <LayoutGrid size={14} />
      </ViewToggleBtn>
      <ViewToggleBtn active={view === 'list'} onClick={() => onChange('list')} title="Список">
        <Rows3 size={14} />
      </ViewToggleBtn>
    </div>
  )
}

function ViewToggleBtn({
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
