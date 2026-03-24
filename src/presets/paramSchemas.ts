import type { ParamSchema } from './presetsStore'

export const PARAM_SCHEMAS: Record<string, ParamSchema[]> = {
  galaxy: [
    { id: 'starCount', label: 'Количество звёзд', type: 'range', min: 500, max: 5000, step: 100, default: 2000 },
    { id: 'speed', label: 'Скорость потока', type: 'range', min: 0, max: 3, step: 0.01, default: 1 },
    { id: 'hueShift', label: 'Сдвиг оттенка', type: 'range', min: 0, max: 360, step: 1, default: 0 },
    { id: 'nebulaIntensity', label: 'Туманности', type: 'range', min: 0, max: 2, step: 0.01, default: 1 },
    { id: 'trailFade', label: 'Шлейф', type: 'range', min: 0, max: 0.3, step: 0.01, default: 0.08 },
  ],
  particles: [
    { id: 'particleCount', label: 'Количество частиц', type: 'range', min: 50, max: 1000, step: 10, default: 200 },
    { id: 'speed', label: 'Скорость', type: 'range', min: 0.2, max: 3, step: 0.01, default: 1 },
    { id: 'trailLength', label: 'Длина шлейфа', type: 'range', min: 0, max: 20, step: 1, default: 8 },
    { id: 'connectionDist', label: 'Дистанция связей', type: 'range', min: 0, max: 200, step: 5, default: 80 },
    { id: 'hueShift', label: 'Сдвиг оттенка', type: 'range', min: 0, max: 360, step: 1, default: 0 },
  ],
  circular: [
    { id: 'ringSize', label: 'Размер колец', type: 'range', min: 0.3, max: 2, step: 0.01, default: 1 },
    { id: 'displace', label: 'Деформация', type: 'range', min: 0, max: 3, step: 0.01, default: 1 },
    { id: 'rotationSpeed', label: 'Скорость вращения', type: 'range', min: 0, max: 3, step: 0.01, default: 1 },
    { id: 'sparkRate', label: 'Частота искр', type: 'range', min: 0, max: 3, step: 0.01, default: 1 },
    { id: 'glow', label: 'Свечение', type: 'range', min: 0, max: 3, step: 0.01, default: 1 },
  ],
  barcode: [
    { id: 'barCount', label: 'Число полос', type: 'range', min: 20, max: 128, step: 1, default: 60 },
    { id: 'barHeight', label: 'Высота полос', type: 'range', min: 0.2, max: 3, step: 0.01, default: 1 },
    { id: 'smoothing', label: 'Сглаживание', type: 'range', min: 0, max: 0.95, step: 0.01, default: 0.8 },
    { id: 'hueSpeed', label: 'Скорость оттенка', type: 'range', min: 0, max: 5, step: 0.01, default: 1 },
    { id: 'chromaShift', label: 'Хром. аберрация', type: 'range', min: 0, max: 4, step: 0.01, default: 1 },
  ],
  face: [
    { id: 'faceSize', label: 'Размер лица', type: 'range', min: 0.3, max: 1.5, step: 0.01, default: 1 },
    { id: 'dotSize', label: 'Размер точек', type: 'range', min: 0.3, max: 3, step: 0.01, default: 1 },
    { id: 'chromaShift', label: 'Хром. аберрация', type: 'range', min: 0, max: 3, step: 0.01, default: 1 },
    { id: 'beatZoom', label: 'Зум по биту', type: 'range', min: 0, max: 3, step: 0.01, default: 1 },
    { id: 'rayLength', label: 'Длина лучей', type: 'range', min: 0, max: 3, step: 0.01, default: 1 },
  ],
  vibe: [
    { id: 'exposure', label: 'Яркость', type: 'range', min: 0.3, max: 2, step: 0.01, default: 1 },
    { id: 'bloomStrength', label: 'Свечение', type: 'range', min: 0, max: 3, step: 0.01, default: 1 },
    { id: 'glow', label: 'Ореол маски', type: 'range', min: 0, max: 3, step: 0.01, default: 1 },
    { id: 'chromaShift', label: 'Хром. аберрация', type: 'range', min: 0, max: 3, step: 0.01, default: 1 },
    { id: 'shakeIntensity', label: 'Тряска', type: 'range', min: 0, max: 3, step: 0.01, default: 1 },
  ],
  witchscope: [
    { id: 'ringSize', label: 'Размер кольца', type: 'range', min: 0.3, max: 2, step: 0.01, default: 1 },
    { id: 'trailFade', label: 'Шлейф', type: 'range', min: 0.05, max: 0.5, step: 0.01, default: 0.15 },
    { id: 'scanSpeed', label: 'Скорость скана', type: 'range', min: 0, max: 3, step: 0.01, default: 1 },
    { id: 'beamMax', label: 'Макс. лучей', type: 'range', min: 0, max: 8, step: 1, default: 4 },
    { id: 'glow', label: 'Свечение', type: 'range', min: 0, max: 3, step: 0.01, default: 1 },
  ],
  tunnelbars: [
    { id: 'barHeight', label: 'Высота полос', type: 'range', min: 0.2, max: 2, step: 0.01, default: 1 },
    { id: 'ringSize', label: 'Размер круга', type: 'range', min: 0.3, max: 2, step: 0.01, default: 1 },
    { id: 'rotationSpeed', label: 'Скорость вращения', type: 'range', min: 0, max: 3, step: 0.01, default: 1 },
    { id: 'smoothing', label: 'Сглаживание', type: 'range', min: 0, max: 0.95, step: 0.01, default: 0.85 },
    { id: 'tilt', label: 'Перспектива', type: 'range', min: 0, max: 3, step: 0.01, default: 1 },
  ],
  card: [
    { id: 'barCount', label: 'Число полос', type: 'range', min: 20, max: 128, step: 1, default: 80 },
    { id: 'smoothing', label: 'Сглаживание', type: 'range', min: 0, max: 0.95, step: 0.01, default: 0.75 },
    { id: 'beatScale', label: 'Пульс по биту', type: 'range', min: 0, max: 3, step: 0.01, default: 1 },
    { id: 'chromaShift', label: 'Хром. аберрация', type: 'range', min: 0, max: 3, step: 0.01, default: 1 },
    { id: 'glow', label: 'Свечение', type: 'range', min: 0, max: 3, step: 0.01, default: 1 },
  ],
}
