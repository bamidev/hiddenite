import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { api } from '../api.ts'
import AddButton from './common/add-button.tsx'
import RemoveButton from './common/remove-button.tsx'
import SongTable, { type SongData } from './song-table.tsx'
import { showToast } from '../error.ts'
import type { LibraryFolder } from './libraries.tsx'

interface RemoteSongData extends SongData {
  path: string
}

function isSongInFolder(song: RemoteSongData, folder: LibraryFolder): boolean {
  const folderPrefix = folder.path.endsWith('/') ? folder.path : `${folder.path}/`
  return song.path === folder.path || song.path.startsWith(folderPrefix)
}

export default function RemoteLibrary({ activeQueueIdRef, folder }: {
  activeQueueIdRef: RefObject<string | null>
  folder?: LibraryFolder
}) {
  const [songs, setSongs] = useState<RemoteSongData[]>([])
  const visibleSongs = folder ? songs.filter(song => isSongInFolder(song, folder)) : songs

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

  async function onRemoveSong(song: SongData) {
    await api.delete(`library/song/${song.id}`)
    loadSongs()
  }

  return (
    <div className="library">
      <SongTable
        songs={visibleSongs}
        renderActions={song => (
          <>
            <AddButton onClick={() => onQueueSong(song)} />
            <RemoveButton onClick={() => onRemoveSong(song)} />
          </>
        )}
        addDialogId={folder ? undefined : 'add-remote-library-song-modal'}
        onAddUrl={folder ? undefined : async (kind, url) => {
          await api.put('library/song/url', { kind, url })
        }}
        onAdded={loadSongs}
      />
    </div>
  )
}
