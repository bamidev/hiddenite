/**
 * Embeds a YouTube video as the song player, controlling playback and volume through the
 * YouTube IFrame API's postMessage protocol.
 */

import { useEffect, useRef } from 'react'

/**
 * Extracts the YouTube video id from a URL, supporting youtu.be short links, `?v=` query
 * parameters, and `/embed/`/`/shorts/` path forms.
 *
 * @param url - The YouTube URL to parse. May be malformed, in which case `null` is returned.
 * @returns The extracted video id, or `null` if it couldn't be determined.
 */
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

/**
 * Renders a YouTube video embed configured for use as an audio player (autoplaying, no visible
 * controls, starting at `elapsedMs`), and drives play/pause and volume through the IFrame API by
 * posting messages into the embed's `contentWindow`. Renders nothing if the video id can't be
 * extracted from `url`.
 *
 * @param url - The YouTube video URL to embed.
 * @param elapsedMs - Milliseconds to start playback at (only applied once, via the initial embed URL).
 * @param playing - Whether the video should be playing; toggled via `playVideo`/`pauseVideo` commands.
 * @param gain - Linear volume multiplier; converted to the IFrame API's 0-100 volume scale and
 *   clamped, so values above 1 can't boost volume past 100 (unlike the default player's GainNode).
 */
export default function YouTubePlayer({ url, elapsedMs, playing, gain }: { url: string, elapsedMs: number, playing: boolean, gain: number }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const videoId = extractYouTubeVideoId(url)

  useEffect(() => {
    const contentWindow = iframeRef.current?.contentWindow
    if (!contentWindow) return
    const func = playing ? 'playVideo' : 'pauseVideo'
    contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*')
  }, [playing])

  // The iframe API only exposes 0-100 volume, so a gain above 1 (boost) just clamps to full
  // volume — it can't amplify past the source's native level like the default player's GainNode can.
  useEffect(() => {
    const contentWindow = iframeRef.current?.contentWindow
    if (!contentWindow) return
    const volume = Math.round(Math.max(0, Math.min(100, gain * 100)))
    contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [volume] }), '*')
  }, [gain])

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
