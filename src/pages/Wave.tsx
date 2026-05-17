import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLibraryStore, type LibraryTrack } from '../store/libraryStore'
import {
  MOOD_ORDER,
  MOOD_LABELS,
  MOOD_GRADIENTS,
  getTracksByMood,
  type MoodId,
} from '../audio/moodEngine'
import MoodPlaylistModal from '../components/wave/MoodPlaylistModal'

type WaveStage = 'select' | 'loading' | 'playlist'

const MOOD_QUESTIONS = [
  'Что слушаем сегодня?',
  'Какой вайб поймать?',
  'Что внутри играет?',
  'На каком ты вайбе?',
  'Как ты?',
]

const LOADING_TEXTS = [
  'Собираю плейлист...',
  'Ищу подходящие треки...',
  'Подбираю вайб...',
  'Слушаю твои треки...',
  'Готовлю настроение...',
]

const LOADING_DURATION_MS = 2000

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const MONO_STACK = "'SF Mono', 'JetBrains Mono', ui-monospace, monospace"

const FEATURE_COLUMNS: { key: keyof NonNullable<LibraryTrack['features']>; label: string; kind: 'hz' | 'num' }[] = [
  { key: 'rmsMean',       label: 'rms μ',       kind: 'num' },
  { key: 'rmsStd',        label: 'rms σ',       kind: 'num' },
  { key: 'centroidMean',  label: 'centroid μ',  kind: 'hz'  },
  { key: 'centroidStd',   label: 'centroid σ',  kind: 'hz'  },
  { key: 'flatnessMean',  label: 'flatness μ',  kind: 'num' },
  { key: 'flatnessStd',   label: 'flatness σ',  kind: 'num' },
  { key: 'zcrMean',       label: 'zcr μ',       kind: 'num' },
  { key: 'zcrStd',        label: 'zcr σ',       kind: 'num' },
  { key: 'loudnessMean',  label: 'loudness μ',  kind: 'num' },
  { key: 'loudnessStd',   label: 'loudness σ',  kind: 'num' },
  { key: 'rolloffMean',   label: 'rolloff μ',   kind: 'hz'  },
  { key: 'rolloffStd',    label: 'rolloff σ',   kind: 'hz'  },
]

function fmt(n: number, kind: 'hz' | 'num'): string {
  if (!Number.isFinite(n)) return '—'
  if (kind === 'hz') return Math.round(n).toString()
  return n.toFixed(3)
}

export default function Wave() {
  const tracks = useLibraryStore((s) => s.tracks)

  const [question] = useState(() => pickRandom(MOOD_QUESTIONS))
  const [stage, setStage] = useState<WaveStage>('select')
  const [selectedMood, setSelectedMood] = useState<MoodId | null>(null)
  const [loadingText, setLoadingText] = useState<string>('')

  const countsByMood = useMemo(() => {
    const counts: Record<MoodId, number> = {
      energetic: 0, upbeat: 0, calm: 0, sad: 0, melancholic: 0,
    }
    for (const m of MOOD_ORDER) counts[m] = getTracksByMood(tracks, m).length
    return counts
  }, [tracks])

  useEffect(() => {
    if (stage !== 'loading') return
    const t = setTimeout(() => setStage('playlist'), LOADING_DURATION_MS)
    return () => clearTimeout(t)
  }, [stage])

  function handleCardClick(mood: MoodId) {
    if (stage !== 'select') return
    if (countsByMood[mood] === 0) return
    setSelectedMood(mood)
    setLoadingText(pickRandom(LOADING_TEXTS))
    setStage('loading')
  }

  function handleBack() {
    setStage('select')
    setSelectedMood(null)
  }

  return (
    <main className="mx-auto max-w-[1400px] px-8 pt-16 pb-32 relative z-[2]">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--fg-mute)] mb-4">
        — Плейлисты по настроению
      </div>
      <h1 className="text-5xl sm:text-6xl font-semibold tracking-[-0.035em] leading-[1.02] mb-6">
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
          которую чувствуешь.
        </span>
      </h1>
      <p
        style={{
          fontSize: 22,
          fontWeight: 400,
          color: 'var(--fg)',
          letterSpacing: '-0.01em',
          marginBottom: 40,
          fontFamily: "'Instrument Serif', serif",
          fontStyle: 'italic',
        }}
      >
        {question}
      </p>

      <div style={{ position: 'relative', minHeight: 280, marginBottom: 64 }}>
        <AnimatePresence mode="wait">
          {stage === 'select' && (
            <motion.div
              key="cards"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
              }}
            >
              {MOOD_ORDER.map((m, idx) => (
                <motion.div
                  key={m}
                  initial={false}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{
                    opacity: 0,
                    scale: 0.94,
                    transition: { duration: 0.32, delay: idx * 0.025, ease: 'easeOut' },
                  }}
                >
                  <MoodCard
                    mood={m}
                    count={countsByMood[m]}
                    onOpenPlaylist={() => handleCardClick(m)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}

          {stage === 'loading' && selectedMood && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}
              style={{
                minHeight: 280,
                borderRadius: 22,
                background: MOOD_GRADIENTS[selectedMood],
                color: '#0a0a0a',
                boxShadow: '0 16px 40px rgba(0,0,0,0.32)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 22,
                padding: 48,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  opacity: 0.7,
                }}
              >
                {MOOD_LABELS[selectedMood]}
              </div>
              <Spinner />
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.32, ease: 'easeOut' }}
                style={{
                  fontSize: 18,
                  fontWeight: 500,
                  color: '#0a0a0a',
                  letterSpacing: '-0.005em',
                }}
              >
                {loadingText}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <DebugSection tracks={tracks} />

      {stage === 'playlist' && selectedMood !== null ? (
        <MoodPlaylistModal
          moodId={selectedMood}
          onClose={() => {
            setStage('select')
            setSelectedMood(null)
          }}
          onBack={handleBack}
        />
      ) : null}
    </main>
  )
}

function Spinner() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 52,
        height: 52,
        borderRadius: '50%',
        border: '3px solid rgba(10,10,10,0.18)',
        borderTopColor: '#0a0a0a',
        animation: 'waveSpin 0.9s linear infinite',
      }}
    >
      <style>{`@keyframes waveSpin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

interface MoodCardProps {
  mood: MoodId
  count: number
  onOpenPlaylist: () => void
}

function MoodCard({ mood, count, onOpenPlaylist }: MoodCardProps) {
  const empty = count === 0
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      onClick={empty ? undefined : onOpenPlaylist}
      disabled={empty}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        height: 120,
        borderRadius: 14,
        border: 'none',
        padding: 18,
        cursor: empty ? 'not-allowed' : 'pointer',
        background: empty ? 'var(--bg-soft)' : MOOD_GRADIENTS[mood],
        color: empty ? 'var(--fg-mute)' : '#0a0a0a',
        opacity: empty ? 0.55 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        transition: 'transform 0.15s, box-shadow 0.15s',
        fontFamily: 'inherit',
        boxShadow: empty ? 'none' : '0 6px 18px rgba(0,0,0,0.25)',
        transform: hovered && !empty ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      <div
        style={{
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: '-0.02em',
        }}
      >
        {MOOD_LABELS[mood]}
      </div>
    </button>
  )
}

interface DebugSectionProps {
  tracks: LibraryTrack[]
}

function DebugSection({ tracks }: DebugSectionProps) {
  return (
    <section>
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--fg-mute)] mb-2">
        Дебаг: сырые признаки
      </div>
      <p style={{ fontSize: 12, color: 'var(--fg-mute)', marginBottom: 16 }}>
        Для разработки. Будет скрыто в финале.
      </p>
      {tracks.length === 0 ? (
        <div
          className="flex items-center justify-center"
          style={{ minHeight: 120, color: 'var(--fg-mute)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 12 }}
        >
          Пока пусто. Добавь треки в библиотеку.
        </div>
      ) : (
        <FeatureTable tracks={tracks} />
      )}
    </section>
  )
}

interface FeatureTableProps {
  tracks: LibraryTrack[]
}

function FeatureTable({ tracks }: FeatureTableProps) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'auto',
        background: 'var(--bg-soft)',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 12,
          color: 'var(--fg)',
        }}
      >
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={headStyle({ width: 56, textAlign: 'left' })}>cover</th>
            <th style={headStyle({ width: 220, textAlign: 'left' })}>title</th>
            <th style={headStyle({ width: 160, textAlign: 'left' })}>artist</th>
            {FEATURE_COLUMNS.map((c) => (
              <th key={c.key as string} style={headStyle({ textAlign: 'right' })}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tracks.map((t, i) => (
            <FeatureRow key={t.id} track={t} odd={i % 2 === 1} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface FeatureRowProps {
  track: LibraryTrack
  odd: boolean
}

function FeatureRow({ track, odd }: FeatureRowProps) {
  const failed = !!track.analyzeFailed
  const analyzing = !!track.isAnalyzing
  const ready = !!track.features

  return (
    <tr
      style={{
        background: odd ? 'var(--bg)' : 'transparent',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <td style={cellStyle()}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 4,
            overflow: 'hidden',
            background: track.cover ? 'transparent' : 'var(--bg-elev)',
            border: '1px solid var(--border)',
          }}
        >
          {track.cover ? (
            <img
              src={track.cover}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : null}
        </div>
      </td>
      <td style={{ ...cellStyle(), color: 'var(--fg)', fontWeight: 500 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="truncate" style={{ maxWidth: 200 }}>{track.name}</span>
          {analyzing ? (
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--fg-mute)',
                animation: 'pulse 1.2s ease-in-out infinite',
              }}
            />
          ) : null}
        </div>
      </td>
      <td style={{ ...cellStyle(), color: 'var(--fg-soft)' }}>
        <span className="truncate" style={{ maxWidth: 140, display: 'inline-block' }}>
          {track.artist}
        </span>
      </td>
      {FEATURE_COLUMNS.map((c) => (
        <td
          key={c.key as string}
          style={{
            ...cellStyle(),
            textAlign: 'right',
            fontFamily: MONO_STACK,
            color: 'var(--fg-mute)',
          }}
        >
          {ready ? fmt(track.features![c.key], c.kind) : failed ? '—' : '...'}
        </td>
      ))}
      <PulseKeyframes />
    </tr>
  )
}

function PulseKeyframes() {
  return (
    <style>{`@keyframes pulse { 0%,100% { opacity: 0.3 } 50% { opacity: 1 } }`}</style>
  )
}

function headStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    padding: '10px 12px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--fg-mute)',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    ...extra,
  }
}

function cellStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    padding: '8px 12px',
    whiteSpace: 'nowrap',
    ...extra,
  }
}
