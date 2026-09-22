import type { SongInfo } from 'hiddenite'
import DefaultPlayer from './song-player/default.tsx'
import BandcampPlayer from './song-player/bandcamp.tsx'
import YouTubePlayer from './song-player/youtube.tsx'
import { replayGainMultiplier } from '../replay-gain.ts'

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
