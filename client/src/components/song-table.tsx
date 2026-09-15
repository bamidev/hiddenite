import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export interface SongData {
  id: string
  tags: Record<string, string>
}

const COLUMNS = ['artist', 'album', 'title', 'rating']
const PAGE_SIZE = 10000
const SIBLING_COUNT = 1
const SEARCH_THRESHOLD = 20

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

export default function SongTable<T extends SongData>({ songs, renderActions }: { songs: T[], renderActions?: (song: T) => ReactNode }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

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
    <div className="song-table">
      {songs.length > SEARCH_THRESHOLD && (
        <input
          type="search"
          className="form-control"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      )}
      <div className="library-table-container table-responsive">
        <table className="table table-striped">
          <thead>
            <tr>
              {COLUMNS.map(key => (
                <th key={key} className="text-capitalize">{key}</th>
              ))}
              {renderActions && <th></th>}
            </tr>
          </thead>
          <tbody>
            {pageSongs.map(song => (
              <tr key={song.id} className="library-row">
                {COLUMNS.map(key => (
                  <td key={key}>{song.tags[key] ?? ''}</td>
                ))}
                {renderActions && (
                  <td className="library-row-actions">
                    {renderActions(song)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
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
      )}
    </div>
  )
}
