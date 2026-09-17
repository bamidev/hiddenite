import { useEffect, useRef } from 'react'

function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.endsWith('youtu.be')) {
      return parsed.pathname.slice(1) || null
    }
    const v = parsed.searchParams.get('v')
    if (v) return v
    const match = parsed.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

export default function YouTubePlayer({ url, elapsedMs, playing }: { url: string, elapsedMs: number, playing: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const videoId = extractYouTubeVideoId(url)

  useEffect(() => {
    const contentWindow = iframeRef.current?.contentWindow
    if (!contentWindow) return
    const func = playing ? 'playVideo' : 'pauseVideo'
    contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*')
  }, [playing])

  if (!videoId) return null

  const start = Math.floor(elapsedMs / 1000)
  const embedSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&disablekb=1&start=${start}&enablejsapi=1`

  return (
    <iframe
      ref={iframeRef}
      title="YouTube player"
      src={embedSrc}
      allow="autoplay; encrypted-media"
      allowFullScreen
      style={{ border: 0, width: '100%', height: '200px' }}
    />
  )
}
