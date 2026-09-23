/**
 * The local library panel: lists songs scanned from disk by the Electron host process, and lets
 * the user queue, remove, rescan, tag-edit, and manage columns for them. Only functional when
 * running inside Electron (`window.electron` is available).
 */

import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { api } from '../../api.ts'
import AddButton from '../common/add-button.tsx'
import RemoveButton from '../common/remove-button.tsx'
import ActionMenu from '../common/action-menu.tsx'
import SongTable from '../song-table.tsx'
import { showToast } from '../../error.ts'

/**
 * A song from the local (Electron-scanned) library, as returned by `window.electron.listSongs`.
 */
export interface LibrarySongData {
  /** Local library id for the song. */
  id: string
  /** For file-based songs, the filesystem path; for URL-based songs, the source URL. */
  path: string
  /** Song kind, e.g. `'file'` for a local audio file, or a `SongKind` value like `'youtube'`. */
  kind: string
  /** Duration in milliseconds, or `null` if unknown. */
  duration: number | null
  /** Tag key/value pairs read from the file (or supplied) metadata. */
  tags: Record<string, string>
}

/**
 * Renders the local library table backed by the Electron host's song index. Loads songs and
 * columns on mount (a no-op outside Electron), and wires up queuing, removal, rescanning,
 * tag editing, and column management to the corresponding `window.electron` calls.
 *
 * @param activeQueueIdRef - Ref to the id of the currently active queue; songs are queued to
 *   this queue when "add" is clicked, and a toast is shown if no queue is active.
 */
export default function LocalLibrary({ activeQueueIdRef }: { activeQueueIdRef: RefObject<string | null> }) {
  const [songs, setSongs] = useState<LibrarySongData[]>([])
  const [columns, setColumns] = useState<string[]>([])

  /**
   * Refreshes `songs` from the Electron host's song index.
   */
  function loadSongs() {
    window.electron?.listSongs().then(setSongs)
  }

  /**
   * Refreshes `columns` from the Electron host's configured tag column list.
   */
  function loadColumns() {
    window.electron?.listColumns().then(setColumns)
  }

  useEffect(() => {
    if (!window.electron?.isElectron) return
    loadSongs()
    loadColumns()
  }, [])

  /**
   * Adds `song` to the currently active queue: for local files, reads the file bytes via
   * Electron and uploads them; for URL-based songs, sends the URL, tags, and duration directly.
   * Shows a toast and bails out if there is no active queue.
   *
   * @param song - The library song to queue.
   */
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

  /**
   * Removes `song` from the local library and refreshes the song list.
   *
   * @param song - The library song to remove.
   */
  async function onRemoveSong(song: LibrarySongData) {
    await window.electron?.removeSong(song.id)
    loadSongs()
  }

  /**
   * Triggers a rescan of the local library folder via Electron and refreshes the song list.
   */
  async function onRescan() {
    await window.electron?.rescanLibrary()
    loadSongs()
  }

  /**
   * Updates a single tag value on `song` and refreshes the song list.
   *
   * @param song - The library song being edited.
   * @param key - The tag name to set.
   * @param value - The new tag value.
   */
  async function onEditTag(song: LibrarySongData, key: string, value: string) {
    await window.electron?.setTag(song.id, key, value)
    loadSongs()
  }

  /**
   * Adds a new tag column and refreshes both the column list and songs (so newly-known tags show up).
   *
   * @param key - The tag name to add as a column.
   */
  async function onAddColumn(key: string) {
    await window.electron?.addColumn(key)
    loadColumns()
    loadSongs()
  }

  /**
   * Removes a tag column and refreshes the column list.
   *
   * @param key - The tag name to remove as a column.
   */
  async function onRemoveColumn(key: string) {
    await window.electron?.removeColumn(key)
    loadColumns()
  }

  return (
    <div className="library">
      <ActionMenu actions={[{ label: 'Rescan', onClick: onRescan }]} />
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
        onEditTag={onEditTag}
        columns={columns}
        onAddColumn={onAddColumn}
        onRemoveColumn={onRemoveColumn}
      />
    </div>
  )
}
