import { useEffect, useRef } from 'react'
import type { VizPreview } from '../../gallery/types'

interface CanvasPreviewProps {
  draw: VizPreview['draw']
  isHovered: boolean
}

export default function CanvasPreview({ draw, isHovered }: CanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tRef = useRef<number>(Math.random() * 1000)
  const hoveredRef = useRef(isHovered)
  const drawRef = useRef(draw)

  useEffect(() => {
    hoveredRef.current = isHovered
  }, [isHovered])

  useEffect(() => {
    drawRef.current = draw
  }, [draw])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let cssW = 0
    let cssH = 0

    function resize() {
      if (!canvas || !container) return
      const rect = container.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      cssW = Math.max(1, Math.floor(rect.width))
      cssH = Math.max(1, Math.floor(rect.height))
      canvas.width = cssW * dpr
      canvas.height = cssH * dpr
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    function loop() {
      tRef.current += hoveredRef.current ? 1.6 : 1
      if (ctx) drawRef.current(ctx, cssW, cssH, tRef.current, hoveredRef.current)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
