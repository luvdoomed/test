import {
  clearTrail,
  fakeAmplitude,
  fillBg,
  isLightTheme,
  premiumColor,
  strokeColor,
} from './previewHelpers'

type Ctx = CanvasRenderingContext2D

export function drawCosmicPreview(ctx: Ctx, w: number, h: number, t: number, isHovered: boolean) {
  clearTrail(ctx, w, h, 0.14)
  const cx = w / 2
  const cy = h / 2
  const amp = fakeAmplitude(t, isHovered)
  for (let i = 0; i < 6; i++) {
    const r = 18 + i * 22 + Math.sin(t * 0.04 + i) * (4 + amp * 14)
    ctx.beginPath()
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.18) {
      const wob = Math.sin(a * 5 + t * 0.05 + i * 0.6) * (2 + amp * 6)
      const rr = r + wob
      const x = cx + Math.cos(a) * rr
      const y = cy + Math.sin(a) * rr * 0.78
      if (a === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.strokeStyle = premiumColor(0.18 + (1 - i / 6) * 0.35)
    ctx.lineWidth = 1.1
    ctx.stroke()
  }
  ctx.fillStyle = premiumColor(0.45 + amp * 0.4)
  ctx.beginPath()
  ctx.arc(cx, cy, 3 + amp * 2, 0, Math.PI * 2)
  ctx.fill()
}

export function drawHaloPreview(ctx: Ctx, w: number, h: number, t: number, isHovered: boolean) {
  fillBg(ctx, w, h)
  const cx = w / 2
  const cy = h / 2
  const amp = fakeAmplitude(t, isHovered)
  const radius = Math.min(w, h) * 0.42
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
  if (isLightTheme()) {
    grad.addColorStop(0, `rgba(20, 20, 20, ${0.35 + amp * 0.3})`)
    grad.addColorStop(0.4, `rgba(20, 20, 20, ${0.12 + amp * 0.1})`)
    grad.addColorStop(1, 'rgba(20, 20, 20, 0)')
  } else {
    grad.addColorStop(0, `rgba(255, 255, 255, ${0.55 + amp * 0.35})`)
    grad.addColorStop(0.35, `rgba(255, 255, 255, ${0.18 + amp * 0.1})`)
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
  }
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = strokeColor(0.85)
  ctx.beginPath()
  ctx.arc(cx, cy, 4 + amp * 3, 0, Math.PI * 2)
  ctx.fill()
}

export function drawCircularPreview(ctx: Ctx, w: number, h: number, t: number, isHovered: boolean) {
  clearTrail(ctx, w, h, 0.18)
  const cx = w / 2
  const cy = h / 2
  const amp = fakeAmplitude(t, isHovered)
  for (let i = 0; i < 5; i++) {
    const r = 14 + i * 16 + Math.sin(t * 0.06 + i * 0.7) * (3 + amp * 8)
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.strokeStyle = strokeColor(0.18 + (1 - i / 5) * 0.4)
    ctx.lineWidth = 1.4
    ctx.stroke()
  }
}

export function drawParticlesPreview(ctx: Ctx, w: number, h: number, t: number, isHovered: boolean) {
  clearTrail(ctx, w, h, 0.16)
  const amp = fakeAmplitude(t, isHovered)
  const speed = isHovered ? 1.6 : 1
  for (let i = 0; i < 60; i++) {
    const seed = i * 7.13
    const x = (Math.sin(seed + t * 0.012 * speed) * 0.5 + 0.5) * w
    const y = (Math.cos(seed * 0.7 + t * 0.014 * speed) * 0.5 + 0.5) * h
    const r = 1 + (Math.sin(seed + t * 0.04) * 0.5 + 0.5) * (1.5 + amp * 2)
    ctx.fillStyle = strokeColor(0.25 + amp * 0.5)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function drawGalaxyPreview(ctx: Ctx, w: number, h: number, t: number, isHovered: boolean) {
  clearTrail(ctx, w, h, 0.12)
  const cx = w / 2
  const cy = h / 2
  const amp = fakeAmplitude(t, isHovered)
  const rot = t * 0.004 * (isHovered ? 1.4 : 1)
  for (let i = 0; i < 200; i++) {
    const arm = i % 3
    const f = i / 200
    const a = f * Math.PI * 6 + rot + arm * 2.094
    const r = f * Math.min(w, h) * 0.48
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r * 0.7
    const alpha = (1 - f) * (0.3 + amp * 0.4)
    ctx.fillStyle = strokeColor(alpha)
    ctx.fillRect(x, y, 1, 1)
  }
}

export function drawGeometryPreview(ctx: Ctx, w: number, h: number, t: number, isHovered: boolean) {
  clearTrail(ctx, w, h, 0.18)
  const cx = w / 2
  const cy = h / 2
  const amp = fakeAmplitude(t, isHovered)
  const layers = 4
  for (let i = 0; i < layers; i++) {
    const sides = 3 + i
    const r = 18 + i * 20 + amp * 8
    const rot = t * 0.012 * (i % 2 === 0 ? 1 : -1) + i * 0.4
    ctx.beginPath()
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2 + rot
      const x = cx + Math.cos(a) * r
      const y = cy + Math.sin(a) * r
      if (s === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = strokeColor(0.2 + (1 - i / layers) * 0.45)
    ctx.lineWidth = 1.1
    ctx.stroke()
  }
}

export function drawWitchscopePreview(ctx: Ctx, w: number, h: number, t: number, isHovered: boolean) {
  clearTrail(ctx, w, h, 0.15)
  const cx = w / 2
  const cy = h / 2
  const amp = fakeAmplitude(t, isHovered)
  ctx.beginPath()
  const steps = 80
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const wob =
      Math.sin(a * 3 + t * 0.05) * (8 + amp * 16) +
      Math.sin(a * 7 + t * 0.07) * (4 + amp * 8)
    const r = 38 + wob
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.strokeStyle = strokeColor(0.55 + amp * 0.3)
  ctx.lineWidth = 1.3
  ctx.stroke()
  ctx.fillStyle = strokeColor(0.06 + amp * 0.06)
  ctx.fill()
}

export function drawVibePreview(ctx: Ctx, w: number, h: number, t: number, isHovered: boolean) {
  clearTrail(ctx, w, h, 0.18)
  const amp = fakeAmplitude(t, isHovered)
  const lines = 6
  for (let i = 0; i < lines; i++) {
    const yc = ((i + 0.5) / lines) * h
    const phase = t * 0.04 + i * 0.7
    ctx.beginPath()
    for (let x = 0; x <= w; x += 4) {
      const y = yc + Math.sin(x * 0.04 + phase) * (4 + amp * 14)
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = strokeColor(0.18 + (1 - i / lines) * 0.4)
    ctx.lineWidth = 1.1
    ctx.stroke()
  }
}

export function drawBarcodePreview(ctx: Ctx, w: number, h: number, t: number, isHovered: boolean) {
  clearTrail(ctx, w, h, 0.18)
  const bars = 48
  const bw = w / bars
  for (let i = 0; i < bars; i++) {
    const norm = (i - bars / 2) / (bars / 2)
    const bell = Math.exp(-norm * norm * 2.2)
    const v = bell * (0.5 + 0.5 * Math.abs(Math.sin(t * 0.04 + i * 0.18)))
    const amp = isHovered ? Math.min(1, v * 1.3) : v
    const bh = amp * h * 0.78
    ctx.fillStyle = strokeColor(0.25 + amp * 0.45)
    ctx.fillRect(i * bw + 1, h - bh, bw - 2, bh)
  }
}

export function drawTunnelPreview(ctx: Ctx, w: number, h: number, t: number, isHovered: boolean) {
  clearTrail(ctx, w, h, 0.16)
  const cx = w / 2
  const cy = h / 2
  const amp = fakeAmplitude(t, isHovered)
  const bars = 36
  const inner = 12
  const maxLen = Math.min(w, h) * 0.42
  for (let i = 0; i < bars; i++) {
    const a = (i / bars) * Math.PI * 2 + t * 0.006
    const len = inner + (0.4 + 0.6 * Math.abs(Math.sin(t * 0.05 + i * 0.4))) * maxLen * (0.5 + amp * 0.6)
    const x1 = cx + Math.cos(a) * inner
    const y1 = cy + Math.sin(a) * inner
    const x2 = cx + Math.cos(a) * len
    const y2 = cy + Math.sin(a) * len
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.strokeStyle = strokeColor(0.25 + amp * 0.4)
    ctx.lineWidth = 1.4
    ctx.stroke()
  }
}

export function drawSpherePreview(ctx: Ctx, w: number, h: number, t: number, isHovered: boolean) {
  clearTrail(ctx, w, h, 0.14)
  const cx = w / 2
  const cy = h / 2
  const amp = fakeAmplitude(t, isHovered)
  const r = Math.min(w, h) * 0.34
  const rot = t * 0.012
  const lats = 8
  const lons = 12
  ctx.strokeStyle = strokeColor(0.22 + amp * 0.3)
  ctx.lineWidth = 1
  for (let lat = 1; lat < lats; lat++) {
    const v = (lat / lats) * Math.PI
    const yr = Math.sin(v) * r
    const yo = -Math.cos(v) * r * 0.6
    ctx.beginPath()
    ctx.ellipse(cx, cy + yo, yr, yr * 0.32, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  for (let lon = 0; lon < lons; lon++) {
    const u = (lon / lons) * Math.PI * 2 + rot
    ctx.beginPath()
    for (let lat = 0; lat <= lats; lat++) {
      const v = (lat / lats) * Math.PI
      const x = cx + Math.cos(u) * Math.sin(v) * r
      const y = cy - Math.cos(v) * r * 0.6
      if (lat === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
}

export function drawFacePreview(ctx: Ctx, w: number, h: number, t: number, isHovered: boolean) {
  fillBg(ctx, w, h)
  const cx = w / 2
  const cy = h / 2
  const amp = fakeAmplitude(t, isHovered)
  const scale = 1 + amp * 0.08
  const r = Math.min(w, h) * 0.3 * scale
  ctx.strokeStyle = strokeColor(0.55)
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  const eyeY = cy - r * 0.18
  const eyeDx = r * 0.36
  ctx.fillStyle = strokeColor(0.7)
  ctx.beginPath()
  ctx.arc(cx - eyeDx, eyeY, 2 + amp * 1.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx + eyeDx, eyeY, 2 + amp * 1.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  const smileR = r * 0.45
  const smileOpen = 0.2 + amp * 0.4
  ctx.arc(cx, cy + r * 0.12, smileR, Math.PI * (0.5 - smileOpen), Math.PI * (0.5 + smileOpen))
  ctx.strokeStyle = strokeColor(0.6)
  ctx.lineWidth = 1.4
  ctx.stroke()
}

export function drawCardPreview(ctx: Ctx, w: number, h: number, t: number, isHovered: boolean) {
  fillBg(ctx, w, h)
  const cx = w / 2
  const cy = h / 2
  const amp = fakeAmplitude(t, isHovered)
  const cw = w * 0.42
  const ch = cw
  const tilt = Math.sin(t * 0.02) * 0.04
  const lift = isHovered ? -4 : 0
  ctx.save()
  ctx.translate(cx, cy + lift)
  ctx.rotate(tilt)
  ctx.shadowColor = isLightTheme() ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 24 + amp * 18
  ctx.shadowOffsetY = 10
  ctx.fillStyle = strokeColor(0.85)
  roundRect(ctx, -cw / 2, -ch / 2, cw, ch, 8)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  ctx.fillStyle = isLightTheme() ? 'rgba(244,243,239,0.3)' : 'rgba(17,17,19,0.35)'
  ctx.beginPath()
  ctx.arc(0, 0, ch * 0.18 + amp * 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}
