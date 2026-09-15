import { useEffect, useState } from 'react'

export interface SongData {
  id: string
  tags: Record<string, string>
}

const COLUMNS = ['artist', 'album', 'title', 'rating']

export default function Library() {
  const [songs, setSongs] = useState<SongData[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!window.electron?.isElectron) return
    window.electron.listSongs().then(setSongs)
  }, [])

  const filteredSongs = songs.filter(song =>
    Object.values(song.tags).some(value => value.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="library">
      <input
        type="search"
        className="form-control"
        placeholder="Search library..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <table className="table table-striped">
        <thead>
          <tr>
            {COLUMNS.map(key => (
              <th key={key} className="text-capitalize">{key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredSongs.map(song => (
            <tr key={song.id}>
              {COLUMNS.map(key => (
                <td key={key}>{song.tags[key] ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
