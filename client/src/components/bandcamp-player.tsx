export default function BandcampPlayer({ url }: { url: string }) {
  const embedSrc = `https://bandcamp.com/EmbeddedPlayer/url=${encodeURIComponent(url)}/size=large/bgcol=333333/linkcol=0f91ff/tracklist=false/artwork=small/transparent=true/`

  return (
    <iframe
      title="Bandcamp player"
      src={embedSrc}
      style={{ border: 0, width: '100%', height: '120px' }}
    />
  )
}
