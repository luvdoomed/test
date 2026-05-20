import { useEffect, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'
import { KaraokeLyricsLayer } from '../components/player/KaraokeLyricsLayer'

/** фон из обложки: масштаб + сильный blur, как в apple music */
function KaraokeArtBackdrop({ coverUrl }: { coverUrl: string }) {
  return (
    <>
      <img
        src={coverUrl}
        alt=""
        aria-hidden
        decoding="async"
        draggable={false}
        style={{
          position: 'absolute',
          inset: '-14%',
          width: '128%',
          height: '128%',
          objectFit: 'cover',
          objectPosition: 'center',
          filter: 'blur(52px) saturate(1.12) brightness(0.52)',
          transform: 'scale(1.06)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 95% 90% at 50% 42%, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.48) 52%, rgba(0,0,0,0.78) 100%)',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          boxShadow: 'inset 0 0 120px rgba(0,0,0,0.55)',
        }}
      />
    </>
  )
}

/** отдельный пресет «karaoke»: обложка на фоне (blur) или реактивный градиент без обложки */
export function KaraokeVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cover = useAudioStore((s) => s.trackInfo.cover?.trim() ?? '')

  useEffect(() => {
    if (cover) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const { energy, beat: b } = useAudioStore.getState()
      const w = canvas.width
      const h = canvas.height
      const pulse = b ? 0.18 : 0
      const e = Math.min(1, energy)
      const base = 0.12 + e * 0.42 + pulse
      const g = ctx.createRadialGradient(
        w * 0.5,
        h * 0.34,
        0,
        w * 0.5,
        h * 0.34,
        Math.max(w, h) * 0.58,
      )
      g.addColorStop(0, `rgba(130, 70, 210, ${0.28 + base * 0.55})`)
      g.addColorStop(0.42, `rgba(40, 120, 200, ${0.12 + base * 0.2})`)
      g.addColorStop(0.72, `rgba(14, 10, 28, ${0.9 + base * 0.06})`)
      g.addColorStop(1, '#030206')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [cover])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', background: '#050308' }}>
      {cover ? <KaraokeArtBackdrop coverUrl={cover} /> : null}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: cover ? 0 : 1,
          pointerEvents: 'none',
        }}
      />
      <KaraokeLyricsLayer variant="standalone" />
    </div>
  )
}
