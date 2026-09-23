/**
 * Shared identity shape for a playable song, used across the desktop and server
 * packages wherever only the minimal identifying fields (not full metadata) are needed.
 */

/**
 * Minimal identity of a playable song.
 */
export interface Song {
  /** Library-assigned identifier for the song (its database row id, as a string). */
  id: string;
  /** Source type of the song, e.g. `'file'`, `'youtube'`, or `'bandcamp'`. */
  kind: string;
  /** Location of the song: a filesystem path for local files, or a URL for streamed sources. */
  path: string;
}
