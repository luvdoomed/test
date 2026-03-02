
export function pixelDiff(prev: ImageData | null, curr: ImageData, threshold: number = 6): number {
  if (!prev) return 0
  if (prev.width !== curr.width || prev.height !== curr.height) return 0
  const a = prev.data
  const b = curr.data
  const px = a.length / 4
  let changed = 0
  for (let i = 0; i < a.length; i += 4) {
    const dr = Math.abs(a[i] - b[i])
    const dg = Math.abs(a[i + 1] - b[i + 1])
    const db = Math.abs(a[i + 2] - b[i + 2])
    if (dr + dg + db > threshold) changed++
  }
  return px > 0 ? changed / px : 0
}

export function brightnessMean(img: ImageData): number {
  const d = img.data
  const px = d.length / 4
  let sum = 0
  for (let i = 0; i < d.length; i += 4) {
    sum += (d[i] + d[i + 1] + d[i + 2]) / 3
  }
  return px > 0 ? sum / (px * 255) : 0
}

export function colorVariance(img: ImageData): { r: number; g: number; b: number } {
  const d = img.data
  const px = d.length / 4
  if (px === 0) return { r: 0, g: 0, b: 0 }
  let sumR = 0, sumG = 0, sumB = 0
  for (let i = 0; i < d.length; i += 4) {
    sumR += d[i]
    sumG += d[i + 1]
    sumB += d[i + 2]
  }
  const mR = sumR / px
  const mG = sumG / px
  const mB = sumB / px
  let varR = 0, varG = 0, varB = 0
  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - mR
    const dg = d[i + 1] - mG
    const db = d[i + 2] - mB
    varR += dr * dr
    varG += dg * dg
    varB += db * db
  }
  return {
    r: Math.sqrt(varR / px) / 255,
    g: Math.sqrt(varG / px) / 255,
    b: Math.sqrt(varB / px) / 255,
  }
}

export function dominantMood(img: ImageData): 'warm' | 'cold' | 'neon' | 'dark' {
  const d = img.data
  const px = d.length / 4
  if (px === 0) return 'dark'
  let sumR = 0, sumG = 0, sumB = 0, sumSat = 0
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]
    const g = d[i + 1]
    const b = d[i + 2]
    sumR += r
    sumG += g
    sumB += b
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    sumSat += max === 0 ? 0 : (max - min) / max
  }
  const mR = sumR / px / 255
  const mG = sumG / px / 255
  const mB = sumB / px / 255
  const brightness = (mR + mG + mB) / 3
  const saturation = sumSat / px
  if (brightness < 0.15) return 'dark'
  if (saturation > 0.6 && brightness > 0.5) return 'neon'
  if (mR > mB) return 'warm'
  return 'cold'
}

export function edgeDensity(img: ImageData, threshold: number = 24): number {
  const w = img.width
  const h = img.height
  if (w < 3 || h < 3) return 0
  const d = img.data
  let edges = 0
  let checked = 0
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const iL = (y * w + (x - 1)) * 4
      const iR = (y * w + (x + 1)) * 4
      const iU = ((y - 1) * w + x) * 4
      const iDn = ((y + 1) * w + x) * 4
      const lumL = (d[iL] + d[iL + 1] + d[iL + 2]) / 3
      const lumR = (d[iR] + d[iR + 1] + d[iR + 2]) / 3
      const lumU = (d[iU] + d[iU + 1] + d[iU + 2]) / 3
      const lumD = (d[iDn] + d[iDn + 1] + d[iDn + 2]) / 3
      const gx = Math.abs(lumL - lumR)
      const gy = Math.abs(lumU - lumD)
      if (gx + gy > threshold) edges++
      checked++
    }
  }
  return checked > 0 ? edges / checked : 0
}
