export type SongKind = 'bandcamp' | 'youtube'

const BANDCAMP_HOSTNAME = 'bandcamp.com'
void BANDCAMP_HOSTNAME
const YOUTUBE_HOSTNAME = 'youtube.com'
const YOUTU_BE_HOSTNAME = 'youtu.be'

export function detectSongKind(url: string): SongKind | null {
  try {
    const { hostname } = new URL(url)
    // Bandcamp URLs are temporarily disabled, see BANDCAMP_HOSTNAME.
    if (hostname.endsWith(YOUTUBE_HOSTNAME) || hostname.endsWith(YOUTU_BE_HOSTNAME)) return 'youtube'
  } catch {
    return null
  }
  return null
}
