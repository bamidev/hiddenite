import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { api } from '../../api.ts'
import AddButton from '../common/add-button.tsx'
import RemoveButton from '../common/remove-button.tsx'
import ActionMenu from '../common/action-menu.tsx'
import SongTable, { type SongData } from '../song-table.tsx'
import { showToast } from '../../error.ts'
import type { LibraryFolder } from '../consolidated-library.tsx'

interface RemoteSongData extends SongData {
  path: string
  folder: string
}

export default function RemoteLibrary({ activeQueueIdRef, folder }: {
  activeQueueIdRef: RefObject<string | null>
  folder?: LibraryFolder
}) {
  const [songs, setSongs] = useState<RemoteSongData[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const visibleSongs = folder ? songs.filter(song => song.folder === folder.path) : songs

  function loadSongs() {
    api.get('library/song').then(response => response.json()).then(setSongs)
  }

  function loadColumns() {
    if (!folder) return
    api.get(`library/column?folder=${encodeURIComponent(folder.path)}`).then(response => response.json()).then(setColumns)
  }

  useEffect(() => {
    loadSongs()
    loadColumns()
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

  async function onRescan() {
    await api.post('library/rescan')
    window.dispatchEvent(new CustomEvent('remote-library-rescanned'))
  }

  async function onEditTag(song: RemoteSongData, key: string, value: string) {
    await api.put(`library/song/${song.id}/tag`, { key, value })
    loadSongs()
  }

  async function onAddColumn(key: string) {
    if (!folder) return
    await api.put('library/column', { folder: folder.path, key })
    loadColumns()
    loadSongs()
  }

  async function onRemoveColumn(key: string) {
    if (!folder) return
    await api.delete('library/column', { folder: folder.path, key })
    loadColumns()
  }

  return (
    <div className="library">
      <ActionMenu actions={[{ label: 'Rescan', onClick: onRescan }]} />
      <SongTable
        songs={visibleSongs}
        renderActions={song => (
          <>
            <AddButton onClick={() => onQueueSong(song)} />
            <RemoveButton onClick={() => onRemoveSong(song)} />
          </>
        )}
        addDialogId={folder ? 'add-remote-library-song-modal' : undefined}
        onAddUrl={folder ? async (kind, url) => {
          await api.put('library/song/url', { kind, url, folder: folder.path })
        } : undefined}
        onAdded={loadSongs}
        onEditTag={onEditTag}
        columns={folder ? columns : undefined}
        onAddColumn={folder ? onAddColumn : undefined}
        onRemoveColumn={folder ? onRemoveColumn : undefined}
      />
    </div>
  )
}
