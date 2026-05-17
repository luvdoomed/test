import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface UserVizDocsModalProps {
  onClose: () => void
}

const EXAMPLE_CODE = `import { useEffect, useRef } from 'react'

export default function MyViz({ audioData, beat, energy, currentTime }) {
  const canvasRef = useRef(null)

  const audioRef = useRef({ audioData, beat, energy, currentTime })
  useEffect(() => {
    audioRef.current = { audioData, beat, energy, currentTime }
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf = 0
    const draw = () => {
      const { energy, beat } = audioRef.current
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = beat ? '#fff' : '#7cf'
      const r = 40 + energy * 1200
      ctx.beginPath()
      ctx.arc(canvas.width / 2, canvas.height / 2, r, 0, Math.PI * 2)
      ctx.fill()
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={1920}
      height={1080}
      style={{ width: '100%', height: '100%', display: 'block', background: '#000' }}
    />
  )
}`

export default function UserVizDocsModal({ onClose }: UserVizDocsModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 75,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '86vh',
          background: 'var(--bg)',
          borderRadius: 18,
          border: '1px solid var(--border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--fg-mute)',
                marginBottom: 4,
              }}
            >
              Документация
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.015em' }}>
              Как написать свой визуализатор
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-soft)',
              color: 'var(--fg-mute)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div
          style={{
            padding: 24,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            fontSize: 14,
            color: 'var(--fg-soft)',
            lineHeight: 1.55,
          }}
        >
          <section>
            <SectionTitle>Что приходит в компонент</SectionTitle>
            <p>
              Любой виз получает четыре пропа от плеера:
            </p>
            <ul style={{ paddingLeft: 18, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li><Code>audioData: Float32Array(1024)</Code> — нормализованный FFT-спектр.</li>
              <li><Code>beat: boolean</Code> — true на 10 кадров после удара.</li>
              <li><Code>energy: number</Code> — средняя энергия. Реальный диапазон 0.01–0.12 (не 0..1!).</li>
              <li><Code>currentTime: number</Code> — секунды воспроизведения.</li>
            </ul>
          </section>

          <section>
            <SectionTitle>Главное правило · stale closure</SectionTitle>
            <p style={{ marginBottom: 6 }}>
              Аудио-пропы обновляются каждый кадр. Если зачитать их прямо в
              {' '}<Code>useEffect</Code> с зависимостями <Code>[audioData, energy]</Code>{' '}
              — эффект будет пересоздаваться каждые ~16мс, и <Code>requestAnimationFrame</Code>
              {' '}успеет отмениться раньше, чем нарисует кадр. Виз застынет статичной картинкой.
            </p>
            <p style={{ marginBottom: 6 }}>
              Правильный паттерн:
            </p>
            <ul style={{ paddingLeft: 18, marginTop: 4, marginBottom: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li>держи свежий снимок аудио в <Code>useRef</Code>;</li>
              <li>обновляй <Code>audioRef.current</Code> в отдельном <Code>useEffect</Code> без массива зависимостей;</li>
              <li>запускай RAF-цикл один раз в <Code>useEffect(..., [])</Code> и читай <Code>audioRef.current</Code> на каждом кадре.</li>
            </ul>
            <p>
              Тот же приём работает для R3F: в <Code>useFrame</Code> читай из <Code>audioRef.current</Code>, а не из пропов.
            </p>
          </section>

          <section>
            <SectionTitle>Минимальный пример</SectionTitle>
            <pre
              style={{
                margin: 0,
                padding: 14,
                borderRadius: 10,
                background: 'var(--bg-soft)',
                border: '1px solid var(--border)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                color: 'var(--fg)',
                overflowX: 'auto',
                lineHeight: 1.45,
              }}
            >
{EXAMPLE_CODE}
            </pre>
          </section>

          <section>
            <SectionTitle>Что доступно</SectionTitle>
            <ul style={{ paddingLeft: 18, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li>React и все его хуки (useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect, useReducer).</li>
              <li>Canvas 2D через <Code>useRef</Code> и <Code>getContext('2d')</Code>.</li>
              <li>WebGL — <Code>canvas.getContext('webgl')</Code>.</li>
              <li>Three.js через <Code>@react-three/fiber</Code> (Canvas, useFrame).</li>
            </ul>
          </section>

          <section>
            <SectionTitle>Советы</SectionTitle>
            <ul style={{ paddingLeft: 18, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li>Корневой элемент должен занимать <Code>width: 100%; height: 100%</Code>.</li>
              <li>Для HiDPI умножай размер canvas на <Code>window.devicePixelRatio</Code>.</li>
              <li>Лучше реагировать на <Code>beat</Code> через ref-flash, чем на каждый перерендер.</li>
              <li>На паузе <Code>currentTime</Code> и <Code>energy</Code> не меняются — анимации замирают сами.</li>
            </ul>
          </section>

          <section>
            <SectionTitle>Ограничения v1</SectionTitle>
            <ul style={{ paddingLeft: 18, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li>Можно импортировать только <Code>react</Code>, <Code>@react-three/fiber</Code> и <Code>three</Code>. Другие пакеты не подключатся.</li>
              <li>Динамические <Code>import()</Code> не работают.</li>
              <li>Ошибки в рантайме ловятся — показывается заглушка «этот виз сломался».</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--fg-mute)',
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
        padding: '1px 6px',
        borderRadius: 4,
        background: 'var(--bg-soft)',
        border: '1px solid var(--border)',
        color: 'var(--fg)',
      }}
    >
      {children}
    </code>
  )
}
