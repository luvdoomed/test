import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

type Status = 'idle' | 'running' | 'done' | 'error'

export default function SystemAudioTest() {
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string>('Ожидание')
  const [level, setLevel] = useState<number>(0)
  const peakRef = useRef<number>(0)
  const [peak, setPeak] = useState<number>(0)

  useEffect(() => {
    let unlisten: UnlistenFn | null = null
    let cancelled = false
    void (async () => {
      const fn = await listen<number>('system-audio-level', (event) => {
        const v = typeof event.payload === 'number' ? event.payload : 0
        setLevel(v)
        if (v > peakRef.current) {
          peakRef.current = v
          setPeak(v)
        }
      })
      if (cancelled) {
        fn()
      } else {
        unlisten = fn
      }
    })()
    return () => {
      cancelled = true
      if (unlisten) unlisten()
    }
  }, [])

  async function onStart() {
    setStatus('running')
    setMessage('Захват аудио идёт 5 секунд')
    setLevel(0)
    peakRef.current = 0
    setPeak(0)
    try {
      const result = await invoke<string>('start_system_audio_test')
      setStatus('done')
      setMessage(`Готово: ${result}`)
    } catch (err) {
      setStatus('error')
      const msg = String(err)
      if (msg.includes('BLACKHOLE_NOT_FOUND')) {
        setMessage('BlackHole не найден. Установи BlackHole 2ch и выбери его как источник звука.')
      } else if (msg.includes('NO_OUTPUT_DEVICE')) {
        setMessage('Не найдено устройство вывода.')
      } else {
        setMessage(`Ошибка: ${msg}`)
      }
    }
  }

  const barScale = 4
  const barHeightPct = Math.min(100, level * 100 * barScale)
  const peakPct = Math.min(100, peak * 100 * barScale)

  return (
    <div
      style={{
        maxWidth: 720,
        margin: '60px auto',
        padding: '32px',
        color: 'var(--fg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>
        Тест захвата системного звука
      </h1>
      <p style={{ color: 'var(--fg-mute)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
        Этот тест проверяет, может ли Rust-сторона приложения захватывать звук, играющий
        на компьютере. На macOS источником должен быть BlackHole (выбери Multi-Output Device
        в системных настройках звука). На Windows используется WASAPI loopback.
      </p>

      <button
        type="button"
        onClick={onStart}
        disabled={status === 'running'}
        style={{
          alignSelf: 'flex-start',
          padding: '10px 18px',
          borderRadius: 10,
          background: status === 'running' ? 'var(--bg-soft)' : 'var(--fg)',
          color: status === 'running' ? 'var(--fg-mute)' : 'var(--bg)',
          border: '1px solid var(--border)',
          fontSize: 14,
          fontWeight: 500,
          cursor: status === 'running' ? 'wait' : 'pointer',
          transition: 'opacity 0.15s',
        }}
      >
        {status === 'running' ? 'Идёт захват…' : 'Start 5s test'}
      </button>

      <div
        style={{
          display: 'flex',
          gap: 32,
          alignItems: 'flex-end',
          height: 240,
          padding: '12px 16px',
          background: 'var(--bg-soft)',
          border: '1px solid var(--border)',
          borderRadius: 12,
        }}
      >
        <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--fg-mute)' }}>RMS уровень</div>
          <div
            style={{
              position: 'relative',
              flex: 1,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: `${barHeightPct}%`,
                background: 'linear-gradient(180deg, #f43f5e 0%, #f59e0b 50%, #10b981 100%)',
                transition: 'height 0.08s linear',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: `${peakPct}%`,
                height: 2,
                background: '#ffffff',
                opacity: 0.7,
              }}
            />
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--fg-mute)' }}>
            level={level.toFixed(4)} · peak={peak.toFixed(4)}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '12px 16px',
          background: 'var(--bg-soft)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          fontSize: 13,
          color: status === 'error' ? '#f43f5e' : 'var(--fg-mute)',
        }}
      >
        Статус: <strong style={{ color: 'var(--fg)' }}>{status}</strong> — {message}
      </div>
    </div>
  )
}
