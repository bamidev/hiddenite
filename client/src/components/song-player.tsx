import type { SongInfo } from 'hiddenite'
import DefaultPlayer from './default-player.tsx'
import BandcampPlayer from './bandcamp-player.tsx'
import YouTubePlayer from './youtube-player.tsx'

export default function SongPlayer({ currentSong, mixSourceId, elapsedMs, playing, cacheBuster }: { currentSong: SongInfo, mixSourceId: string, elapsedMs: number, playing: boolean, cacheBuster: number }) {
  if (currentSong.kind === 'bandcamp') {
    return <BandcampPlayer url={currentSong.path} />
  }

  if (currentSong.kind === 'youtube') {
    return <YouTubePlayer url={currentSong.path} elapsedMs={elapsedMs} playing={playing} />
  }

  return <DefaultPlayer mixSourceId={mixSourceId} elapsedMs={elapsedMs} playing={playing} cacheBuster={cacheBuster} />
}
