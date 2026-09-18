import { useEffect, useState } from 'react'
import { api } from '../api.ts'
import SongTable, { type SongData } from './song-table.tsx'
import AddSongDialog from './add-song-dialog.tsx'
import RemoveButton from './common/remove-button.tsx'

export interface QueueData {
  id: string
  name: string
  shuffle: boolean
  repeat: boolean
  autoAdd: boolean
  filter: string
}

export default function Queue({ queue }: { queue: QueueData }) {
  const [shuffle, setShuffle] = useState(queue.shuffle)
  const [repeat, setRepeat] = useState(queue.repeat)
  const [autoAdd, setAutoAdd] = useState(queue.autoAdd)
  const [filter, setFilter] = useState(queue.filter)
  const [songs, setSongs] = useState<SongData[]>([])

  function loadSongs() {
    api.get(`queue/${queue.id}/song`).then(r => r.json()).then(setSongs)
  }

  useEffect(() => {
    loadSongs()

    function onSongAdded(event: Event) {
      const { queueId } = (event as CustomEvent<{ queueId: string }>).detail
      if (queueId === queue.id) loadSongs()
    }

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

  async function onRemoveSong(song: SongData) {
    await api.delete(`queue/${queue.id}/song/${song.id}`)
    loadSongs()
  }

  async function onToggleShuffle() {
    const response = await api.post(`queue/${queue.id}/shuffle`)
    const updated: QueueData = await response.json()
    setShuffle(updated.shuffle)
  }

  async function onToggleRepeat() {
    const response = await api.post(`queue/${queue.id}/repeat`)
    const updated: QueueData = await response.json()
    setRepeat(updated.repeat)
  }

  async function onToggleAutoAdd() {
    const response = await api.post(`queue/${queue.id}/auto-add`)
    const updated: QueueData = await response.json()
    setAutoAdd(updated.autoAdd)
    loadSongs()
  }

  async function onFilterCommit() {
    await api.put(`queue/${queue.id}/filter`, { filter })
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
      </div>
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
