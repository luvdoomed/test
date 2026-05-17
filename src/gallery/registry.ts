import type { VizPreview } from './types'
import * as P from './previews'

export const GALLERY: VizPreview[] = [
  { id: 'cosmic',     name: 'Космос',     category: 'premium',    subcategory: 'Атмосфера',  badge: 'premium', moods: ['melancholic', 'calm'],                draw: P.drawCosmicPreview },
  { id: 'halo',       name: 'Гало',       category: 'effects',    subcategory: 'Аура',       badge: 'new',     moods: ['calm', 'melancholic', 'sad'],         draw: P.drawHaloPreview },
  { id: 'circular',   name: 'Круг',       category: 'basic',      subcategory: 'Реактив',    badge: null,      moods: ['energetic', 'upbeat'],                draw: P.drawCircularPreview },
  { id: 'particles',  name: 'Частицы',    category: 'effects',    subcategory: 'Движение',   badge: null,      moods: ['upbeat', 'energetic', 'calm'],        draw: P.drawParticlesPreview },
  { id: 'galaxy',     name: 'Галактика',  category: 'atmosphere', subcategory: 'Космос',     badge: null,      moods: ['melancholic', 'calm', 'sad'],         draw: P.drawGalaxyPreview },
  { id: 'geometry',   name: 'Геометрия',  category: 'effects',    subcategory: 'Геометрия',  badge: null,      moods: ['upbeat', 'energetic', 'calm'],        draw: P.drawGeometryPreview },
  { id: 'witchscope', name: 'Ведьма',     category: 'effects',    subcategory: 'Генератив',  badge: null,      moods: ['energetic', 'upbeat'],                draw: P.drawWitchscopePreview },
  { id: 'vibe',       name: 'Вайб',       category: 'effects',    subcategory: 'Волна',      badge: null,      moods: ['melancholic', 'sad', 'calm'],         draw: P.drawVibePreview },
  { id: 'barcode',    name: 'Баркод',     category: 'basic',      subcategory: 'Частоты',    badge: null,      moods: ['energetic', 'upbeat'],                draw: P.drawBarcodePreview },
  { id: 'tunnelbars', name: 'Кино',       category: 'effects',    subcategory: 'Кино',       badge: null,      moods: ['energetic', 'upbeat'],                draw: P.drawTunnelPreview },
  { id: 'sphere',     name: 'Сфера',      category: 'effects',    subcategory: '3D',         badge: null,      moods: ['calm', 'melancholic', 'sad'],         draw: P.drawSpherePreview },
  { id: 'face',       name: 'Лицо',       category: 'atmosphere', subcategory: 'Портрет',    badge: null,      moods: ['sad', 'melancholic', 'calm'],         draw: P.drawFacePreview },
  { id: 'card',       name: 'Карточка',   category: 'atmosphere', subcategory: 'Обложка',    badge: null,      moods: ['upbeat', 'calm', 'melancholic'],      draw: P.drawCardPreview },
  { id: 'karaoke',    name: 'Караоке',    category: 'atmosphere', subcategory: 'Текст',      badge: 'new',     moods: ['upbeat', 'calm', 'sad'],              draw: P.drawKaraokePreview },
  { id: 'beatgame',   name: 'Игра',       category: 'effects',    subcategory: 'Игра',       badge: 'new',     moods: ['energetic', 'upbeat'],                draw: P.drawBeatGamePreview },
]
