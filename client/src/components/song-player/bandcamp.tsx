import { useRef } from 'react'

const PLAY_BUTTON_OFFSET_X = 165
const PLAY_BUTTON_OFFSET_Y = 95

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

export default function BandcampPlayer({ url }: { url: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const embedSrc = `https://bandcamp.com/EmbeddedPlayer/url=${encodeURIComponent(url)}/size=large/bgcol=333333/linkcol=0f91ff/tracklist=false/artwork=small/transparent=true/`

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
