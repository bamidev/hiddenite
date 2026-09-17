import { useEffect, useState } from 'react'
import { api } from '../api.ts'
import SongTable, { type SongData } from './song-table.tsx'

export default function RemoteLibrary() {
  const [songs, setSongs] = useState<SongData[]>([])

  useEffect(() => {
    api.get('library/song').then(response => response.json()).then(setSongs)
  }, [])

  return (
    <div className="library">
      <SongTable songs={songs} />
    </div>
  )
}
