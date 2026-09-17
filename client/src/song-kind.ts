export type SongKind = 'bandcamp' | 'youtube'

const BANDCAMP_HOSTNAME = 'bandcamp.com'
const YOUTUBE_HOSTNAME = 'youtube.com'
const YOUTU_BE_HOSTNAME = 'youtu.be'

export function detectSongKind(url: string): SongKind | null {
  try {
    const { hostname } = new URL(url)
    if (hostname.endsWith(BANDCAMP_HOSTNAME)) return 'bandcamp'
    if (hostname.endsWith(YOUTUBE_HOSTNAME) || hostname.endsWith(YOUTU_BE_HOSTNAME)) return 'youtube'
  } catch {
    return null
  }
  return null
}
