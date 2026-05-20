/** стабильный ключ для кэша текста: имя файла + размер в байтах */
export function makeTrackLyricsKey(fileName: string, byteSize: number): string {
  return `${fileName}\0${byteSize}`
}
