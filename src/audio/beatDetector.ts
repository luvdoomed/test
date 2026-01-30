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
}}
