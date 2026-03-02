
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
