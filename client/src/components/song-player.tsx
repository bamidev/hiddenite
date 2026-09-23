/**
 * Dispatches playback of the currently playing song to the right embedded player component
 * based on its `SongKind` (Bandcamp iframe, YouTube iframe, or the default direct-stream audio
 * player), applying ReplayGain to the two players that support it.
 */

import type { SongInfo } from 'hiddenite'
import DefaultPlayer from './song-player/default.tsx'
import BandcampPlayer from './song-player/bandcamp.tsx'
import YouTubePlayer from './song-player/youtube.tsx'
import { replayGainMultiplier } from '../replay-gain.ts'

/**
 * Selects and renders the appropriate player for `currentSong`'s kind: `BandcampPlayer` for
 * Bandcamp songs, `YouTubePlayer` for YouTube songs, and `DefaultPlayer` (direct audio stream
 * from the server) for everything else. Computes the ReplayGain multiplier once and passes it to
 * `YouTubePlayer`/`DefaultPlayer` (Bandcamp's embed doesn't support external gain control).
 *
 * @param currentSong - The song to play, including its kind, path/URL, and tag metadata.
 * @param mixSourceId - Id of the mix source, used by `DefaultPlayer` to build the stream URL.
 * @param elapsedMs - Milliseconds already elapsed into the song, used to seek playback on load.
 * @param playing - Whether playback should be active.
 * @param cacheBuster - A value that changes per song load, appended to the stream URL to avoid
 *   the browser reusing a stale cached/paused audio element.
 */
export default function SongPlayer({ currentSong, mixSourceId, elapsedMs, playing, cacheBuster }: { currentSong: SongInfo, mixSourceId: string, elapsedMs: number, playing: boolean, cacheBuster: number }) {
  const gain = replayGainMultiplier(currentSong.metadata.tags)

  if (currentSong.kind === 'bandcamp') {
    return <BandcampPlayer url={currentSong.path} />
  }

  if (currentSong.kind === 'youtube') {
    return <YouTubePlayer url={currentSong.path} elapsedMs={elapsedMs} playing={playing} gain={gain} />
  }

  return <DefaultPlayer mixSourceId={mixSourceId} elapsedMs={elapsedMs} playing={playing} cacheBuster={cacheBuster} gain={gain} />
}
