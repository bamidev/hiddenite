import type { SongInfo } from 'common'
import DefaultPlayer from './default-player.tsx'
import BandcampPlayer from './bandcamp-player.tsx'

export default function SongPlayer({ currentSong, mixSourceId, elapsedMs, playing }: { currentSong: SongInfo, mixSourceId: string, elapsedMs: number, playing: boolean }) {
  if (currentSong.kind === 'bandcamp') {
    return <BandcampPlayer url={currentSong.path} />
  }

  return <DefaultPlayer mixSourceId={mixSourceId} elapsedMs={elapsedMs} playing={playing} />
}
