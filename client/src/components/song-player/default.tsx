/**
 * The default song player: a plain HTML `<audio>` element streaming directly from the server,
 * routed through a Web Audio `GainNode` so ReplayGain can be applied. Used for library songs
 * that aren't Bandcamp or YouTube.
 */

import { useEffect, useRef } from 'react'
import { api } from '../../api.ts'
import { showToast } from '../../error.ts'

/**
 * Renders an `<audio>` element streaming the mix source's current song from the server,
 * connected through a `GainNode` for ReplayGain, seeked to `elapsedMs` on load, and
 * played/paused according to `playing`. If autoplay is blocked by the browser, shows a toast and
 * retries playback on the next click anywhere on the page.
 *
 * @param mixSourceId - Id of the mix source, used to build the stream URL.
 * @param elapsedMs - Milliseconds to seek to once the audio's metadata has loaded.
 * @param playing - Whether the audio should be playing.
 * @param cacheBuster - A value appended as a query parameter to the stream URL so the browser
 *   doesn't reuse a stale audio resource across song changes.
 * @param gain - Linear volume multiplier applied via the `GainNode` (see {@link replayGainMultiplier}).
 */
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
