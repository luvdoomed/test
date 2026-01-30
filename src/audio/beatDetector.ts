const DEFAULT_HISTORY_SIZE = 43
const BASS_BINS = 14
const DEFAULT_BEAT_HOLD = 22

export interface BeatDetectorOptions {
  historySize?: number
  beatHold?: number
}

export class BeatDetector {
  energyHistory: number[] = []
  threshold: number = 1.15

  private readonly historySize: number
  private readonly beatHold: number

  private holdCounter = 0

  constructor(options: BeatDetectorOptions = {}) {
    this.historySize = options.historySize ?? DEFAULT_HISTORY_SIZE
    this.beatHold = options.beatHold ?? DEFAULT_BEAT_HOLD
  }

  detect(dataArray: Float32Array): boolean {
    let bassEnergy = 0
    for (let i = 0; i < BASS_BINS; i++) {
      bassEnergy += dataArray[i]
    }
    bassEnergy /= BASS_BINS

    // детектируем только когда cooldown истёк и история заполнена
    if (this.holdCounter === 0 && this.energyHistory.length >= this.historySize) {
      let weightedSum = 0
      let totalWeight = 0
      for (let i = 0; i < this.energyHistory.length; i++) {
        const weight = Math.exp(i * 0.05)
        weightedSum += this.energyHistory[i] * weight
        totalWeight += weight
      }
}}}
