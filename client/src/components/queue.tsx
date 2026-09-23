/**
 * A single playback queue belonging to a mix source: its songs, shuffle/repeat/auto-add toggles,
 * an auto-add filter and source folder, and the controls to manage all of that.
 */

import { useEffect, useState } from 'react'
import { api } from '../api.ts'
import SongTable, { type SongData } from './song-table.tsx'
import AddSongDialog from './dialog/add-song.tsx'
import RemoveButton from './common/remove-button.tsx'
import type { LibraryFolder } from './consolidated-library.tsx'

/**
 * Server-side state of a queue, as returned by the `queue` endpoints.
 */
export interface QueueData {
  id: string
  name: string
  /** Whether songs are played back in randomized order. */
  shuffle: boolean
  /** Whether the queue repeats (behavior defined server-side, e.g. looping once exhausted). */
  repeat: boolean
  /** Whether the queue automatically pulls in new songs matching `filter` from `autoAddFolder`. */
  autoAdd: boolean
  /** Tag-based filter string used to select songs when auto-add is enabled. */
  filter: string
  /** Path of the remote library folder auto-add pulls songs from, or `null` if none is selected. */
  autoAddFolder: string | null
}

/**
 * Renders a queue's controls (shuffle, repeat, auto-add with a folder picker and filter input,
 * add-song dialog) and its song table. Loads the queue's songs on mount and refreshes them in
 * response to `queue-song-added`/`queue-song-taken` window events scoped to this queue's id.
 *
 * @param queue - The queue's initial state, used to seed local toggle/filter state.
 * @param folders - Remote library folders offered as auto-add source options. The auto-add
 *   controls are hidden entirely when this list is empty.
 */
export default function Queue({ queue, folders }: { queue: QueueData, folders: LibraryFolder[] }) {
  const [shuffle, setShuffle] = useState(queue.shuffle)
  const [repeat, setRepeat] = useState(queue.repeat)
  const [autoAdd, setAutoAdd] = useState(queue.autoAdd)
  const [filter, setFilter] = useState(queue.filter)
  const [autoAddFolder, setAutoAddFolder] = useState(queue.autoAddFolder)
  const [songs, setSongs] = useState<SongData[]>([])

  /**
   * Refreshes `songs` from the server for this queue.
   */
  function loadSongs() {
    api.get(`queue/${queue.id}/song`).then(r => r.json()).then(setSongs)
  }

  useEffect(() => {
    loadSongs()

    /**
     * Reloads songs if the `queue-song-added` event's queue id matches this queue.
     */
    function onSongAdded(event: Event) {
      const { queueId } = (event as CustomEvent<{ queueId: string }>).detail
      if (queueId === queue.id) loadSongs()
    }

    /**
     * Reloads songs if the `queue-song-taken` event's queue id matches this queue.
     */
    function onSongTaken(event: Event) {
      const { queueId } = (event as CustomEvent<{ queueId: string }>).detail
      if (queueId === queue.id) loadSongs()
    }

    window.addEventListener('queue-song-added', onSongAdded)
    window.addEventListener('queue-song-taken', onSongTaken)
    return () => {
      window.removeEventListener('queue-song-added', onSongAdded)
      window.removeEventListener('queue-song-taken', onSongTaken)
    }
  }, [queue.id])

  /**
   * Removes `song` from this queue via the API and refreshes the song list.
   *
   * @param song - The queued song to remove.
   */
  async function onRemoveSong(song: SongData) {
    await api.delete(`queue/${queue.id}/song/${song.id}`)
    loadSongs()
  }

  /**
   * Toggles shuffle for this queue via the API and updates local state from the response.
   */
  async function onToggleShuffle() {
    const response = await api.post(`queue/${queue.id}/shuffle`)
    const updated: QueueData = await response.json()
    setShuffle(updated.shuffle)
  }

  /**
   * Toggles repeat for this queue via the API and updates local state from the response.
   */
  async function onToggleRepeat() {
    const response = await api.post(`queue/${queue.id}/repeat`)
    const updated: QueueData = await response.json()
    setRepeat(updated.repeat)
  }

  /**
   * Toggles auto-add for this queue via the API, updates local state from the response, and
   * refreshes the song list (auto-add may immediately pull in new songs).
   */
  async function onToggleAutoAdd() {
    const response = await api.post(`queue/${queue.id}/auto-add`)
    const updated: QueueData = await response.json()
    setAutoAdd(updated.autoAdd)
    loadSongs()
  }

  /**
   * Persists the current `filter` value to the server (called on blur) and refreshes the song list.
   */
  async function onFilterCommit() {
    await api.put(`queue/${queue.id}/filter`, { filter })
    loadSongs()
  }

  /**
   * Sets the auto-add source folder for this queue via the API, updates local state from the
   * response, and refreshes the song list.
   *
   * @param folder - The library folder to auto-add songs from.
   */
  async function onSelectAutoAddFolder(folder: LibraryFolder) {
    const response = await api.post(`queue/${queue.id}/auto-add-folder`, { folder: folder.path })
    const updated: QueueData = await response.json()
    setAutoAddFolder(updated.autoAddFolder)
    loadSongs()
  }

  return (
    <>
      <button
        type="button"
        className={`btn btn-sm ${shuffle ? 'btn-primary' : 'btn-outline-secondary'}`}
        onClick={onToggleShuffle}
      >
        Shuffle
      </button>
      <button
        type="button"
        className={`btn btn-sm ${repeat ? 'btn-primary' : 'btn-outline-secondary'}`}
        onClick={onToggleRepeat}
      >
        Repeat
      </button>
      {folders.length > 0 && (
        <div className="input-group input-group-sm w-auto">
          <button
            type="button"
            className={`btn ${autoAdd ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={onToggleAutoAdd}
          >
            Auto-add
          </button>
          <input
            type="text"
            className="form-control"
            placeholder="Filter..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            onBlur={onFilterCommit}
          />
          <button
            type="button"
            className="btn btn-outline-secondary dropdown-toggle"
            data-bs-toggle="dropdown"
            aria-expanded="false"
          >
            {folders.find(folder => folder.path === autoAddFolder)?.name ?? folders[0].name}
          </button>
          <ul className="dropdown-menu">
            {folders.map(folder => (
              <li key={folder.name}>
                <a
                  className={`dropdown-item${folder.path === autoAddFolder ? ' active' : ''}`}
                  href="#"
                  onClick={() => onSelectAutoAddFolder(folder)}
                >
                  {folder.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <AddSongDialog
        id={`add-song-modal-${queue.id}`}
        onAddFile={async file => {
          const formData = new FormData()
          formData.append('file', file, file.name)
          await api.put(`queue/${queue.id}/song`, formData)
        }}
        onAddUrl={async (kind, url) => {
          await api.put(`queue/${queue.id}/song/url`, { kind, url })
        }}
        onAdded={() => window.dispatchEvent(new CustomEvent('queue-song-added', { detail: { queueId: queue.id } }))}
      />
      <SongTable
        songs={songs}
        renderActions={song => <RemoveButton onClick={() => onRemoveSong(song)} />}
      />
    </>
  )
}
