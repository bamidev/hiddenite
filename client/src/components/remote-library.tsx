import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { api } from '../api.ts'
import AddButton from './common/add-button.tsx'
import SongTable, { type SongData } from './song-table.tsx'
import { showToast } from '../error.ts'

export default function RemoteLibrary({ activeQueueIdRef }: { activeQueueIdRef: RefObject<string | null> }) {
  const [songs, setSongs] = useState<SongData[]>([])

  function loadSongs() {
    api.get('library/song').then(response => response.json()).then(setSongs)
  }

  useEffect(() => {
    loadSongs()
    window.addEventListener('remote-library-rescanned', loadSongs)
    return () => window.removeEventListener('remote-library-rescanned', loadSongs)
  }, [])

  async function onQueueSong(song: SongData) {
    const queueId = activeQueueIdRef.current
    if (!queueId) {
      showToast('no-active-queue')
      return
    }

    await api.put(`queue/${queueId}/song/library`, { songId: song.id })
    window.dispatchEvent(new CustomEvent('queue-song-added', { detail: { queueId } }))
  }

  return (
    <div className="library">
      <SongTable
        songs={songs}
        renderActions={song => <AddButton onClick={() => onQueueSong(song)} />}
        addDialogId="add-remote-library-song-modal"
        onAddUrl={async (kind, url) => {
          await api.put('library/song/url', { kind, url })
        }}
        onAdded={loadSongs}
      />
    </div>
  )
}
