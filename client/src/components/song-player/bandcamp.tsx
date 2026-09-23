/**
 * Embeds a Bandcamp track via its iframe player. Bandcamp's embed exposes no postMessage API for
 * remote control, so under Electron this simulates a click on the embed's own play button at a
 * fixed pixel offset once the iframe has loaded.
 */

import { useRef } from 'react'

const PLAY_BUTTON_OFFSET_X = 165
const PLAY_BUTTON_OFFSET_Y = 95

/**
 * Briefly shows a small red dot at the given viewport coordinates, as a visual debugging aid for
 * where the simulated Electron click landed.
 *
 * @param x - Viewport X coordinate.
 * @param y - Viewport Y coordinate.
 */
function showClickMarker(x: number, y: number) {
  const marker = document.createElement('div')
  marker.style.position = 'fixed'
  marker.style.left = `${x - 5}px`
  marker.style.top = `${y - 5}px`
  marker.style.width = '10px'
  marker.style.height = '10px'
  marker.style.borderRadius = '50%'
  marker.style.background = 'red'
  marker.style.zIndex = '99999'
  marker.style.pointerEvents = 'none'
  document.body.appendChild(marker)
  setTimeout(() => marker.remove(), 1500)
}

/**
 * Renders a Bandcamp track embed. When running inside Electron, simulates a click on the embed's
 * play button (at a fixed offset from the iframe's top-left corner) shortly after it loads, since
 * autoplay can't be triggered otherwise.
 *
 * @param url - The Bandcamp track/album URL to embed.
 */
export default function BandcampPlayer({ url }: { url: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const embedSrc = `https://bandcamp.com/EmbeddedPlayer/url=${encodeURIComponent(url)}/size=large/bgcol=333333/linkcol=0f91ff/tracklist=false/artwork=small/transparent=true/`

  /**
   * Called when the Bandcamp iframe finishes loading. Inside Electron, schedules a simulated
   * click at the embed's play button position after a delay (to let the embed finish rendering).
   */
  function handleLoad() {
    if (!window.electron?.isElectron) return
    const rect = iframeRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = rect.left + PLAY_BUTTON_OFFSET_X
    const y = rect.top + PLAY_BUTTON_OFFSET_Y
    setTimeout(async () => {
      await window.electron!.clickAt(x, y)
      showClickMarker(x, y)
    }, 5000)
  }

  return (
    <iframe
      ref={iframeRef}
      title="Bandcamp player"
      src={embedSrc}
      onLoad={handleLoad}
      style={{ border: 0, width: '100%', height: '120px' }}
    />
  )
}
