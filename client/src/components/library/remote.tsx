/**
 * A remote (server-hosted) library folder panel: lists songs from the server's song index
 * belonging to a given folder, and lets the user queue, remove, rescan, tag-edit, and manage
 * columns for them via the API.
 */

import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { LibraryRescanEvent } from 'hiddenite'
import { api } from '../../api.ts'
import AddButton from '../common/add-button.tsx'
import RemoveButton from '../common/remove-button.tsx'
import ActionMenu from '../common/action-menu.tsx'
import SongTable, { type SongData } from '../song-table.tsx'
import { showToast } from '../../error.ts'
import type { LibraryFolder } from '../consolidated-library.tsx'

/**
 * A song from the server's remote library index, as returned by the `library/song` endpoint.
 */
interface RemoteSongData extends SongData {
  /** Server-side path/URL identifying the song. */
  path: string
  /** Path of the folder this song belongs to; matched against `folder.path` to filter the view. */
  folder: string
}

/**
 * Renders a remote library folder's song table. Loads all remote songs (client-side filtered
 * down to the given `folder`) and that folder's tag columns on mount, refreshing songs whenever
 * a rescan (triggered by this or any other client) completes, via the `library/events` SSE
 * stream. When `folder` is omitted, all songs across every remote folder are shown and
 * folder-specific actions (rescan, add song, column management) are disabled.
 *
 * @param activeQueueIdRef - Ref to the id of the currently active queue; songs are queued to
 *   this queue when "add" is clicked, and a toast is shown if no queue is active.
 * @param folder - The remote folder to show songs for. When omitted, shows the consolidated
 *   view across all folders with folder-scoped actions disabled.
 */
export default function RemoteLibrary({ activeQueueIdRef, folder }: {
  activeQueueIdRef: RefObject<string | null>
  folder?: LibraryFolder
}) {
  const [songs, setSongs] = useState<RemoteSongData[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [rescanning, setRescanning] = useState(false)
  const visibleSongs = folder ? songs.filter(song => song.folder === folder.path) : songs

  /**
   * Refreshes `songs` from the server's remote library song index.
   */
  function loadSongs() {
    api.get('library/song').then(response => response.json()).then(setSongs)
  }

  /**
   * Refreshes `columns` from the server for the current `folder`. No-op when there is no folder.
   */
  function loadColumns() {
    if (!folder) return
    api.get(`library/column?folder=${encodeURIComponent(folder.path)}`).then(response => response.json()).then(setColumns)
  }

  useEffect(() => {
    loadSongs()
    loadColumns()

    const eventSource = new EventSource(`${api.baseUrl}/library/events`)
    eventSource.onmessage = e => {
      const event: LibraryRescanEvent = JSON.parse(e.data)
      if (event.folder === folder?.path) setRescanning(false)
      if (event.status === 'failed') showToast('library-rescan-failed')
      loadSongs()
    }
    return () => eventSource.close()
  }, [])

  /**
   * Adds `song` to the currently active queue via the API. Shows a toast and bails out if there
   * is no active queue.
   *
   * @param song - The library song to queue.
   */
  async function onQueueSong(song: SongData) {
    const queueId = activeQueueIdRef.current
    if (!queueId) {
      showToast('no-active-queue')
      return
    }

    await api.put(`queue/${queueId}/song/library`, { songId: song.id })
    window.dispatchEvent(new CustomEvent('queue-song-added', { detail: { queueId } }))
  }

  /**
   * Removes `song` from the remote library via the API and refreshes the song list.
   *
   * @param song - The library song to remove.
   */
  async function onRemoveSong(song: SongData) {
    await api.delete(`library/song/${song.id}`)
    loadSongs()
  }

  /**
   * Requests a rescan of the current `folder` on the server, showing a loading indicator until
   * it completes or fails. The rescan runs in the background; all `RemoteLibrary` instances
   * refresh once it completes, via the `library/events` SSE stream. No-op when there is no folder.
   */
  async function onRescan() {
    if (!folder) return
    setRescanning(true)
    try {
      await api.post('library/rescan', { folder: folder.path })
    } catch (err) {
      setRescanning(false)
      throw err
    }
  }

  /**
   * Updates a single tag value on `song` via the API and refreshes the song list.
   *
   * @param song - The library song being edited.
   * @param key - The tag name to set.
   * @param value - The new tag value.
   */
  async function onEditTag(song: RemoteSongData, key: string, value: string) {
    await api.put(`library/song/${song.id}/tag`, { key, value })
    loadSongs()
  }

  /**
   * Adds a new tag column for the current `folder` via the API and refreshes columns and songs.
   * No-op when there is no folder.
   *
   * @param key - The tag name to add as a column.
   */
  async function onAddColumn(key: string) {
    if (!folder) return
    await api.put('library/column', { folder: folder.path, key })
    loadColumns()
    loadSongs()
  }

  /**
   * Removes a tag column for the current `folder` via the API and refreshes the column list.
   * No-op when there is no folder.
   *
   * @param key - The tag name to remove as a column.
   */
  async function onRemoveColumn(key: string) {
    if (!folder) return
    await api.delete('library/column', { folder: folder.path, key })
    loadColumns()
  }

  return (
    <div className="library">
      <ActionMenu actions={[{ label: 'Rescan', onClick: onRescan }]} />
      {rescanning && (
        <span className="spinner-border spinner-border-sm ms-2" role="status" aria-label="Rescanning…" />
      )}
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
