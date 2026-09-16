import { useEffect, useRef } from 'react'
import { api } from '../api.ts'

export default function SongPlayer({ mixSourceId, elapsedMs, playing }: { mixSourceId: string, elapsedMs: number, playing: boolean }) {
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
    if (playing) {
      audio.play()
    } else {
      audio.pause()
    }
  }, [playing])

  return (
    <audio ref={audioRef} src={`${api.baseUrl}/mix-source/${mixSourceId}/stream`} />
  )
}
