import type { VizPreview } from './types'

export const GALLERY: VizPreview[] = [
  { id: 'cosmic',     name: 'Космос',     category: 'premium',    subcategory: 'Атмосфера',  badge: 'premium', moods: ['melancholic', 'calm'] },
  { id: 'halo',       name: 'Гало',       category: 'effects',    subcategory: 'Аура',       badge: 'new',     moods: ['calm', 'melancholic', 'sad'] },
  { id: 'circular',   name: 'Круг',       category: 'basic',      subcategory: 'Реактив',    badge: null,      moods: ['energetic', 'upbeat'] },
  { id: 'particles',  name: 'Частицы',    category: 'effects',    subcategory: 'Движение',   badge: null,      moods: ['upbeat', 'energetic', 'calm'] },
  { id: 'galaxy',     name: 'Галактика',  category: 'atmosphere', subcategory: 'Космос',     badge: null,      moods: ['melancholic', 'calm', 'sad'] },
  { id: 'geometry',   name: 'Геометрия',  category: 'effects',    subcategory: 'Геометрия',  badge: null,      moods: ['upbeat', 'energetic', 'calm'] },
  { id: 'witchscope', name: 'Ведьма',     category: 'effects',    subcategory: 'Генератив',  badge: null,      moods: ['energetic', 'upbeat'] },
  { id: 'vibe',       name: 'Вайб',       category: 'effects',    subcategory: 'Волна',      badge: null,      moods: ['melancholic', 'sad', 'calm'] },
  { id: 'barcode',    name: 'Баркод',     category: 'basic',      subcategory: 'Частоты',    badge: null,      moods: ['energetic', 'upbeat'] },
  { id: 'tunnelbars', name: 'Кино',       category: 'effects',    subcategory: 'Кино',       badge: null,      moods: ['energetic', 'upbeat'] },
  { id: 'sphere',     name: 'Сфера',      category: 'effects',    subcategory: '3D',         badge: null,      moods: ['calm', 'melancholic', 'sad'] },
  { id: 'face',       name: 'Лицо',       category: 'atmosphere', subcategory: 'Портрет',    badge: null,      moods: ['sad', 'melancholic', 'calm'] },
  { id: 'karaoke',    name: 'Караоке',    category: 'atmosphere', subcategory: 'Текст',      badge: 'new',     moods: ['upbeat', 'calm', 'sad'] },
]
