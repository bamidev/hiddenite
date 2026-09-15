import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { api } from '../api.ts'
import AddButton from './common/add-button.tsx'

export interface SongData {
  id: string
  path: string
  type: string
  tags: Record<string, string>
}

const COLUMNS = ['artist', 'album', 'title', 'rating']
const PAGE_SIZE = 10000
const SIBLING_COUNT = 1

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  const keep = new Set<number>()
  keep.add(0)
  keep.add(total - 1)
  for (let i = current - SIBLING_COUNT; i <= current + SIBLING_COUNT; i++) {
    if (i >= 0 && i < total) keep.add(i)
  }

  const sorted = [...keep].sort((a, b) => a - b)
  const pages: (number | 'ellipsis')[] = []
  let prev: number | undefined
  for (const i of sorted) {
    if (prev !== undefined && i - prev > 1) pages.push('ellipsis')
    pages.push(i)
    prev = i
  }
  return pages
}

export default function Library({ activeQueueIdRef }: { activeQueueIdRef: RefObject<string | null> }) {
  const [songs, setSongs] = useState<SongData[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  function onQueueSong(song: SongData) {
    const queueId = activeQueueIdRef.current
    if (!queueId) return
    api.put(`queue/${queueId}/song`, { id: song.id, kind: song.type, path: song.path })
  }

  useEffect(() => {
    if (!window.electron?.isElectron) return
    window.electron.listSongs().then(setSongs)
  }, [])

  useEffect(() => {
    setPage(0)
  }, [search])

  const filteredSongs = songs.filter(song =>
    Object.values(song.tags).some(value => value.toLowerCase().includes(search.toLowerCase()))
  )

  const pageCount = Math.max(1, Math.ceil(filteredSongs.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const pageSongs = filteredSongs.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  return (
    <div className="library">
      <input
        type="search"
        className="form-control"
        placeholder="Search library..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="library-table-container table-responsive">
        <table className="table table-striped">
          <thead>
            <tr>
              {COLUMNS.map(key => (
                <th key={key} className="text-capitalize">{key}</th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pageSongs.map(song => (
              <tr key={song.id} className="library-row">
                {COLUMNS.map(key => (
                  <td key={key}>{song.tags[key] ?? ''}</td>
                ))}
                <td className="library-row-actions">
                  <AddButton onClick={() => onQueueSong(song)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav>
        <ul className="pagination">
          <li className={`page-item${currentPage === 0 ? ' disabled' : ''}`}>
            <button type="button" className="page-link" onClick={() => setPage(currentPage - 1)}>
              Previous
            </button>
          </li>
          {getPageNumbers(currentPage, pageCount).map((i, index) => (
            i === 'ellipsis' ? (
              <li key={`ellipsis-${index}`} className="page-item disabled">
                <span className="page-link">&hellip;</span>
              </li>
            ) : (
              <li key={i} className={`page-item${i === currentPage ? ' active' : ''}`}>
                <button type="button" className="page-link" onClick={() => setPage(i)}>
                  {i + 1}
                </button>
              </li>
            )
          ))}
          <li className={`page-item${currentPage === pageCount - 1 ? ' disabled' : ''}`}>
            <button type="button" className="page-link" onClick={() => setPage(currentPage + 1)}>
              Next
            </button>
          </li>
        </ul>
      </nav>
    </div>
  )
}
