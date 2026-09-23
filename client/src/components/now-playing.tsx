/**
 * Displays the "Artist - Title" label for the currently playing song, derived from its tags.
 */

/**
 * Renders `artist - title` (or just whichever is present) from the song's tags. Renders nothing
 * if neither tag is set.
 *
 * @param tags - The currently playing song's tag map; only `artist` and `title` are read.
 */
export default function NowPlaying({ tags }: { tags: Record<string, string> }) {
  if (!tags.artist && !tags.title) return null

  return (
    <span className="now-playing">
      {tags.artist}
      {tags.artist && tags.title && ' - '}
      {tags.title}
    </span>
  )
}
