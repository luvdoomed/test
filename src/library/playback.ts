import { audioEngine, shouldAutoPlayAfterPrepare } from '../audio/audioEngine'
import { useLibraryStore, type LibraryTrack } from '../store/libraryStore'
import { isPendingAudioPath, trackNeedsLocalFile } from '../utils/trackCloud'
import { useAuthStore } from '../store/authStore'
import { downloadCloudAudioToDevice } from '../services/cloudTrackAudio'

export async function loadTrack(track: LibraryTrack): Promise<void> {
  if (track.audioPath && isPendingAudioPath(track.audioPath)) {
    const hasCloud = useAuthStore.getState().cloudAudioTrackIds.includes(track.id)
    if (hasCloud) {
      await downloadCloudAudioToDevice(track.id)
      const updated = useLibraryStore.getState().tracks.find((t) => t.id === track.id)
      if (updated?.audioPath && !isPendingAudioPath(updated.audioPath)) {
        await audioEngine.loadFromPath(updated.audioPath, updated.originalFileName)
        useLibraryStore.getState().syncTrackDisplayFromAudio(track.id)
        return
      }
    }
    throw new Error(
      'Нет локального файла. Загрузи тот же MP3 в библиотеку или скачай из облака (если прикреплял).',
    )
  }

  if (trackNeedsLocalFile(track)) {
    throw new Error('Добавь аудиофайл для этого трека (перетащи MP3 в библиотеку).')
  }

  if (track.audioPath) {
    await audioEngine.loadFromPath(track.audioPath, track.originalFileName)
  } else if (track.file) {
    await audioEngine.loadFile(track.file)
  } else {
    throw new Error('Трек не имеет источника аудио')
  }
  useLibraryStore.getState().syncTrackDisplayFromAudio(track.id)
}

export function autoPlayIfLyricsReady(): void {
  if (shouldAutoPlayAfterPrepare()) audioEngine.play()
}
