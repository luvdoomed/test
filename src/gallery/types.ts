import type { MoodId } from '../audio/moodEngine'

export type VizCategory = 'premium' | 'basic' | 'effects' | 'atmosphere'
export type VizBadge = 'premium' | 'new' | null

export interface VizPreview {
  id: string
  name: string
  category: VizCategory
  subcategory: string
  badge: VizBadge
  moods: MoodId[]
}
