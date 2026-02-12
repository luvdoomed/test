import type { ReactElement } from 'react'
import type { VizItem } from './components/Layout/Sidebar'
import { ParticlesVisualizer } from './visual/ParticlesVisualizer'
import { StarfieldVisualizer } from './visual/GalaxyVisualizer'
import { CircularVisualizer } from './visual/CircularVisualizer'
import { ShaderSphereVisualizer } from './visual/ShaderSphereVisualizer'
import { CardVisualizer } from './visual/CardVisualizer'
import { BarcodeVisualizer } from './visual/BarcodeVisualizer'
import { TunnelBarsVisualizer } from './visual/TunnelBarsVisualizer'
import { GeometryVisualizer } from './visual/GeometryVisualizer'
import { WitchscopeVisualizer } from './visual/WitchscopeVisualizer'
import { VibeVisualizer } from './visual/VibeVisualizer'
import { FaceVisualizer } from './visual/FaceVisualizer'
import { KaraokeVisualizer } from './visual/KaraokeVisualizer'
import { BeatGameVisualizer } from './visual/BeatGameVisualizer'
import { HaloVisualizer } from './visual/HaloVisualizer'
import { CosmicVisualizer } from './visual/CosmicVisualizer'

export type VisualizerMode =
  | 'cosmic'
  | 'circular'
  | 'particles'
  | 'sphere'
  | 'galaxy'
  | 'card'
  | 'barcode'
  | 'tunnelbars'
  | 'geometry'
  | 'witchscope'
  | 'vibe'
  | 'face'
  | 'karaoke'
  | 'beatgame'
  | 'halo'

export const VIZ_ITEMS: VizItem[] = [
  { key: 'cosmic', label: 'Космос', icon: '✦', category: 'Премиум' },
  { key: 'circular', label: 'Круг', icon: '◎', category: 'Базовые' },
  { key: 'particles', label: 'Частицы', icon: '✷', category: 'Эффекты' },
  { key: 'sphere', label: 'Сфера', icon: '◉', category: 'Эффекты' },
  { key: 'galaxy', label: 'Галактика', icon: '✧', category: 'Атмосфера' },
  { key: 'card', label: 'Карточка', icon: '▭', category: 'Атмосфера' },
  { key: 'barcode', label: 'Баркод', icon: '┃', category: 'Эффекты' },
  { key: 'tunnelbars', label: 'Кино', icon: '■', category: 'Атмосфера' },
  { key: 'geometry', label: 'Геометрия', icon: '◇', category: 'Эффекты' },
  { key: 'witchscope', label: 'Ведьма', icon: '◌', category: 'Эффекты' },
  { key: 'vibe', label: 'Вайб', icon: '✽', category: 'Эффекты' },
  { key: 'face', label: 'Лицо', icon: '☺', category: 'Эффекты' },
  { key: 'karaoke', label: 'Караоке', icon: '♫', category: 'Плеер' },
  { key: 'beatgame', label: 'Игра', icon: '◎', category: 'Плеер' },
  { key: 'halo', label: 'Halo', icon: '◯', category: 'Эффекты' },
]

export function renderVisualizer(mode: VisualizerMode): ReactElement {
  switch (mode) {
    case 'cosmic': return <CosmicVisualizer />
    case 'circular': return <CircularVisualizer />
    case 'particles': return <ParticlesVisualizer />
    case 'sphere': return <ShaderSphereVisualizer />
    case 'galaxy': return <StarfieldVisualizer />
    case 'card': return <CardVisualizer />
    case 'barcode': return <BarcodeVisualizer />
    case 'tunnelbars': return <TunnelBarsVisualizer />
    case 'geometry': return <GeometryVisualizer />
    case 'witchscope': return <WitchscopeVisualizer />
    case 'vibe': return <VibeVisualizer />
    case 'face': return <FaceVisualizer />
    case 'karaoke': return <KaraokeVisualizer />
    case 'beatgame': return <BeatGameVisualizer />
    case 'halo': return <HaloVisualizer />
  }
}
