import { Vibrant } from 'node-vibrant/browser'

export interface CoverPalette {
  vibrant: string
  muted: string
  darkVibrant: string
  lightVibrant: string
}

export async function extractCoverColors(coverUrl: string): Promise<CoverPalette | null> {
  try {
    const palette = await Vibrant.from(coverUrl).getPalette()
    return {
      vibrant: palette.Vibrant?.hex ?? '#ff8aa3',
      muted: palette.Muted?.hex ?? '#8a7575',
      darkVibrant: palette.DarkVibrant?.hex ?? '#4a3a3a',
      lightVibrant: palette.LightVibrant?.hex ?? '#fdf6ee',
    }
  } catch (err) {
    console.warn('[vibrant] не удалось извлечь палитру:', err)
    return null
  }
}

export function applyCoverPalette(palette: CoverPalette | null): void {
  const root = document.documentElement
  if (!palette) {
    root.style.removeProperty('--accent-auto')
    root.style.removeProperty('--accent-auto-dark')
    root.style.removeProperty('--accent-auto-light')
    return
  }
  root.style.setProperty('--accent-auto', palette.vibrant)
  root.style.setProperty('--accent-auto-dark', palette.darkVibrant)
  root.style.setProperty('--accent-auto-light', palette.lightVibrant)
}
