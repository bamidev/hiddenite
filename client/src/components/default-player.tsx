import { useEffect, useRef } from 'react'
import { api } from '../api.ts'
import { showToast } from '../error.ts'

export default function DefaultPlayer({ mixSourceId, elapsedMs, playing, cacheBuster }: { mixSourceId: string, elapsedMs: number, playing: boolean, cacheBuster: number }) {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    function onLoadedMetadata() {
      audio!.currentTime = elapsedMs / 1000
    }

    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    return () => audio.removeEventListener('loadedmetadata', onLoadedMetadata)
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (!playing) {
      audio.pause()
      return
    }

    function retry() {
      audio!.play().catch(() => {})
    }

    audio.play().catch(() => {
      showToast('autoplay-blocked')
      document.addEventListener('click', retry, { once: true })
    })

    return () => document.removeEventListener('click', retry)
  }, [playing])

  return (
    <audio ref={audioRef} src={`${api.baseUrl}/mix-source/${mixSourceId}/stream?t=${cacheBuster}`} />
  )
}
