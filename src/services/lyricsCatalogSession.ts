/** сессия: не дергать lrclib повторно для того же файла; mutex на время запроса */

const finished = new Set<string>()
const probing = new Set<string>()

export function tryBeginLrclibProbe(trackKey: string): boolean {
  if (finished.has(trackKey)) return false
  if (probing.has(trackKey)) return false
  probing.add(trackKey)
  return true
}

/** finished только если попытка завершена (не обрыв сети — иначе можно повторить) */
export function endLrclibProbe(trackKey: string, markFinished: boolean): void {
  probing.delete(trackKey)
  if (markFinished) finished.add(trackKey)
}

export function resetLyricsCatalogStateForRetry(trackKey: string): void {
  finished.delete(trackKey)
  probing.delete(trackKey)
}

export function isLyricsCatalogFinished(trackKey: string): boolean {
  return finished.has(trackKey)
}
