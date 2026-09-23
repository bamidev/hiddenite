/**
 * Detects which external song provider a URL belongs to (Bandcamp or YouTube), used to decide
 * which embedded player component to use for a given song.
 */

/**
 * The external provider a non-library song's URL points to. Determines which embedded player
 * (Bandcamp iframe or YouTube iframe) is used to play it.
 */
export type SongKind = 'bandcamp' | 'youtube'

const BANDCAMP_HOSTNAME = 'bandcamp.com'
void BANDCAMP_HOSTNAME
const YOUTUBE_HOSTNAME = 'youtube.com'
const YOUTU_BE_HOSTNAME = 'youtu.be'

/**
 * Determines the {@link SongKind} of a URL by inspecting its hostname. Bandcamp URLs are
 * currently disabled (see `BANDCAMP_HOSTNAME`) and always fall through to `null`.
 *
 * @param url - The URL to inspect. May be malformed, in which case `null` is returned.
 * @returns The detected song kind, or `null` if the URL isn't recognized (or is invalid).
 */
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
