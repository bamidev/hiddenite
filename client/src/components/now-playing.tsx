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
