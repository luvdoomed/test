export function isLightTheme(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.getAttribute('data-theme') === 'light'
}

export function clearTrail(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  alpha = 0.18,
) {
  ctx.fillStyle = isLightTheme()
    ? `rgba(244, 243, 239, ${alpha})`
    : `rgba(17, 17, 19, ${alpha})`
  ctx.fillRect(0, 0, w, h)
}

export function fillBg(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = isLightTheme() ? '#f4f3ef' : '#111113'
  ctx.fillRect(0, 0, w, h)
}

export function fakeAmplitude(t: number, isHovered: boolean): number {
  const base = Math.abs(Math.sin(t * 0.03)) * 0.6 + Math.abs(Math.sin(t * 0.07)) * 0.4
  return isHovered ? Math.min(1, base * 1.3) : base
}

export function strokeColor(alpha: number): string {
  return isLightTheme() ? `rgba(20, 20, 20, ${alpha})` : `rgba(255, 255, 255, ${alpha})`
}

export function fillColor(alpha: number): string {
  return strokeColor(alpha)
}

export function premiumColor(alpha: number): string {
  return isLightTheme() ? `rgba(139, 111, 58, ${alpha})` : `rgba(212, 184, 118, ${alpha})`
}
