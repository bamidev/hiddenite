import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { api } from '../api.ts'
import AddButton from './common/add-button.tsx'
import RemoveButton from './common/remove-button.tsx'
import SongTable from './song-table.tsx'
import { showToast } from '../error.ts'

export interface LibrarySongData {
  id: string
  path: string
  kind: string
  duration: number | null
  tags: Record<string, string>
}

export default function LocalLibrary({ activeQueueIdRef }: { activeQueueIdRef: RefObject<string | null> }) {
  const [songs, setSongs] = useState<LibrarySongData[]>([])

  function loadSongs() {
    window.electron?.listSongs().then(setSongs)
  }

  useEffect(() => {
    if (!window.electron?.isElectron) return
    loadSongs()
  }, [])

  async function onQueueSong(song: LibrarySongData) {
    const queueId = activeQueueIdRef.current
    if (!queueId || !window.electron) {
      showToast('no-active-queue')
      return
    }

    const formData = new FormData()
    formData.append('kind', song.kind)
    if (song.kind === 'file') {
      const data = await window.electron.readFile(song.path)
      formData.append('file', new Blob([data as BlobPart]), song.path.split('/').pop())
    } else {
      formData.append('url', song.path)
      formData.append('tags', JSON.stringify(song.tags))
      if (song.duration != null) formData.append('duration', String(song.duration))
    }
    await api.put(`queue/${queueId}/song`, formData)
    window.dispatchEvent(new CustomEvent('queue-song-added', { detail: { queueId } }))
  }

  async function onRemoveSong(song: LibrarySongData) {
    await window.electron?.removeSong(song.id)
    loadSongs()
  }

  return (
    <div className="library">
      <SongTable
        songs={songs}
        renderActions={song => (
          <>
            <AddButton onClick={() => onQueueSong(song)} />
            <RemoveButton onClick={() => onRemoveSong(song)} />
          </>
        )}
        addDialogId="add-library-song-modal"
        onAddFile={async file => {
          const path = (file as File & { path: string }).path
          await window.electron?.addFileSong(path)
        }}
        onAddUrl={async (kind, url) => {
          await window.electron?.addUrlSong(kind, url)
        }}
        onAdded={loadSongs}
      />
    </div>
  )
}
