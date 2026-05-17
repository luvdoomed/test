import { audioEngine } from '../audio/audioEngine'
import type { LibraryTrack } from '../store/libraryStore'

export async function loadTrack(track: LibraryTrack): Promise<void> {
  if (track.audioPath) {
    await audioEngine.loadFromPath(track.audioPath)
    return
  }
  if (track.file) {
    await audioEngine.loadFile(track.file)
    return
  }
  throw new Error('Трек не имеет источника аудио')
}
