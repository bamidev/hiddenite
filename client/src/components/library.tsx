import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { api } from '../api.ts'
import AddButton from './common/add-button.tsx'
import SongTable from './song-table.tsx'
import { showToast } from '../error.ts'
import AddSongDialog from './add-song-dialog.tsx'

export interface LibrarySongData {
  id: string
  path: string
  type: string
  tags: Record<string, string>
}

export default function Library({ activeQueueIdRef }: { activeQueueIdRef: RefObject<string | null> }) {
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

    const data = await window.electron.readFile(song.path)
    const formData = new FormData()
    formData.append('file', new Blob([data]), song.path.split('/').pop())
    await api.put(`queue/${queueId}/song`, formData)
    window.dispatchEvent(new CustomEvent('queue-song-added', { detail: { queueId } }))
  }

  return (
    <div className="library">
      <AddSongDialog
        id="add-library-song-modal"
        onAddFile={async file => {
          const path = (file as File & { path: string }).path
          await window.electron?.addFileSong(path)
        }}
        onAddUrl={async (kind, url) => {
          await window.electron?.addUrlSong(kind, url)
        }}
        onAdded={loadSongs}
      />
      <SongTable
        songs={songs}
        renderActions={song => <AddButton onClick={() => onQueueSong(song)} />}
      />
    </div>
  )
}
