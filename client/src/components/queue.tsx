import { useEffect, useState } from 'react'
import { api } from '../api.ts'
import SongTable, { type SongData } from './song-table.tsx'
import AddSongDialog from './add-song-dialog.tsx'

export interface QueueData {
  id: string
  name: string
  shuffle: boolean
  repeat: boolean
  autoAdd: boolean
}

export default function Queue({ queue }: { queue: QueueData }) {
  const [shuffle, setShuffle] = useState(queue.shuffle)
  const [repeat, setRepeat] = useState(queue.repeat)
  const [autoAdd, setAutoAdd] = useState(queue.autoAdd)
  const [songs, setSongs] = useState<SongData[]>([])

  useEffect(() => {
    function loadSongs() {
      api.get(`queue/${queue.id}/song`).then(r => r.json()).then(setSongs)
    }

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
      <button
        type="button"
        className={`btn btn-sm ${autoAdd ? 'btn-primary' : 'btn-outline-secondary'}`}
        onClick={onToggleAutoAdd}
      >
        Auto-add
      </button>
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
      <SongTable songs={songs} />
    </>
  )
}
