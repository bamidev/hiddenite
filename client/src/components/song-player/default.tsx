import { useEffect, useRef } from 'react'
import { api } from '../../api.ts'
import { showToast } from '../../error.ts'

export default function DefaultPlayer({ mixSourceId, elapsedMs, playing, cacheBuster, gain }: { mixSourceId: string, elapsedMs: number, playing: boolean, cacheBuster: number, gain: number }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Routes the element through a GainNode so ReplayGain can be applied; the AudioContext is
  // created once per mount (SongPlayer remounts DefaultPlayer on every song change via its key).
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const audioContext = new AudioContext()
    const gainNode = audioContext.createGain()
    gainNode.gain.value = gain
    audioContext.createMediaElementSource(audio).connect(gainNode).connect(audioContext.destination)
    audioContextRef.current = audioContext

    return () => {
      audioContextRef.current = null
      audioContext.close()
    }
  }, [])

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
      audioContextRef.current?.resume()
      audio!.play().catch(() => {})
    }

    audioContextRef.current?.resume()
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
