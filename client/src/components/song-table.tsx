/**
 * A generic, reusable song listing table: search, pagination, configurable/editable tag
 * columns (with add/remove column dialogs), a duration column, and per-row action buttons.
 * Used by the local library, remote library, and queue views.
 */

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import AddSongDialog from './dialog/add-song.tsx'
import AddColumnDialog from './dialog/add-column.tsx'
import type { SongKind } from '../song-kind.ts'

/**
 * The minimum shape a song must have to be rendered in a `SongTable`. Callers typically extend
 * this with extra fields (e.g. `path`, `folder`).
 */
export interface SongData {
  id: string
  /** Tag key/value pairs, used both for column display and for search matching. */
  tags: Record<string, string>
  /** Duration in milliseconds. `undefined`/`null` renders as a blank duration cell. */
  duration?: number | null
}

// Used when the caller doesn't manage a persisted column list (e.g. the queue table).
const DEFAULT_TAG_COLUMNS = ['artist', 'album', 'title', 'rating']
const PAGE_SIZE = 10000
const SIBLING_COUNT = 1
const SEARCH_THRESHOLD = 20

/**
 * Formats a millisecond duration as `minutes:seconds` (e.g. `3:07`), or an empty string if unknown.
 *
 * @param duration - Duration in milliseconds, or `null`/`undefined` if unknown.
 * @returns The formatted `m:ss` string, or `''` when `duration` is `null`/`undefined`.
 */
function formatDuration(duration: number | null | undefined): string {
  if (duration == null) return ''
  const totalSeconds = Math.round(duration / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * A table cell showing a tag value that turns into a text input for editing on double-click,
 * committing the change (calling `onSave`) on blur only if the value actually changed.
 *
 * @param value - The current tag value to display, and to prefill the input with when editing.
 * @param onSave - Called with the new value when editing ends with a change.
 */
function EditableTagCell({ value, onSave }: { value: string, onSave: (value: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  if (!editing) {
    return (
      <td onDoubleClick={() => { setDraft(value); setEditing(true) }}>{value}</td>
    )
  }

  /**
   * Exits edit mode and, if the draft value differs from the original, calls `onSave` with it.
   */
  function commit() {
    setEditing(false)
    if (draft !== value) onSave(draft)
  }

  return (
    <td>
      <input
        type="text"
        className="form-control form-control-sm"
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur()
          else if (e.key === 'Escape') { setDraft(value); setEditing(false) }
        }}
      />
    </td>
  )
}

/**
 * A column header label that reveals a "Delete" action on double-click, closing the menu when
 * clicking outside of it. Used for columns that support removal.
 *
 * @param label - The column's display name.
 * @param onDelete - Called when the "Delete" action is clicked.
 */
function ColumnHeaderMenu({ label, onDelete }: { label: string, onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div className="action-menu" ref={ref} onDoubleClick={() => setOpen(o => !o)}>
      {label}
      {open && (
        <div className="action-menu-list">
          <button
            type="button"
            className="action-menu-item"
            onClick={() => { setOpen(false); onDelete() }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Computes the list of page numbers (and 'ellipsis' gap markers) to show in the pagination
 * control: always the first and last page, plus `SIBLING_COUNT` pages around the current one.
 *
 * @param current - Zero-based index of the current page.
 * @param total - Total number of pages.
 * @returns An ordered list of zero-based page indices interspersed with `'ellipsis'` markers
 *   wherever a gap is skipped.
 */
function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  const keep = new Set<number>()
  keep.add(0)
  keep.add(total - 1)
  for (let i = current - SIBLING_COUNT; i <= current + SIBLING_COUNT; i++) {
    if (i >= 0 && i < total) keep.add(i)
  }

  const sorted = [...keep].sort((a, b) => a - b)
  const pages: (number | 'ellipsis')[] = []
  let prev: number | undefined
  for (const i of sorted) {
    if (prev !== undefined && i - prev > 1) pages.push('ellipsis')
    pages.push(i)
    prev = i
  }
  return pages
}

/**
 * Renders a searchable, paginated table of songs with configurable tag columns, an optional
 * "add song" dialog, optional inline tag editing, and optional column add/remove controls. Which
 * optional features are shown is entirely driven by which optional props are supplied (e.g.
 * omitting `onAddUrl` hides the add-song dialog; omitting `onAddColumn` hides the add-column
 * button).
 *
 * @param songs - The full (unfiltered, unpaginated) list of songs to display.
 * @param renderActions - Renders the per-row action buttons (e.g. add/remove) for a song. When
 *   omitted, no actions column is rendered.
 * @param addDialogId - DOM id for the "add song" modal. Required (together with `onAddUrl`) for
 *   the add-song dialog to render.
 * @param onAddFile - Called when a song is added via local file upload. Passed through to
 *   `AddSongDialog`; when omitted, that dialog's file-upload section is hidden.
 * @param onAddUrl - Called when a song is added via URL. Required for the add-song dialog to render.
 * @param onAdded - Called after a song has been successfully added. Defaults to a no-op when omitted.
 * @param onEditTag - Called with a song, tag key, and new value when a tag cell is edited. When
 *   omitted, tag cells render as plain (non-editable) text.
 * @param columns - The tag columns to display, in order. Defaults to `DEFAULT_TAG_COLUMNS` when
 *   omitted (used by callers that don't manage a persisted column list, e.g. the queue table).
 * @param onAddColumn - Called with a new tag name when a column is added. When omitted, the
 *   add-column control is hidden.
 * @param onRemoveColumn - Called with a tag name when a column is removed. When omitted, columns
 *   render without a delete option.
 */
export default function SongTable<T extends SongData>({
  songs,
  renderActions,
  addDialogId,
  onAddFile,
  onAddUrl,
  onAdded,
  onEditTag,
  columns: columnsProp,
  onAddColumn,
  onRemoveColumn,
}: {
  songs: T[]
  renderActions?: (song: T) => ReactNode
  addDialogId?: string
  onAddFile?: (file: File) => Promise<void>
  onAddUrl?: (kind: SongKind, url: string) => Promise<void>
  onAdded?: () => void
  onEditTag?: (song: T, key: string, value: string) => void
  columns?: string[]
  onAddColumn?: (key: string) => void
  onRemoveColumn?: (key: string) => void
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [addColumnDialogId] = useState(() => `add-column-dialog-${Math.random().toString(36).slice(2)}`)
  const columns = columnsProp ?? DEFAULT_TAG_COLUMNS

  useEffect(() => {
    setPage(0)
  }, [search])

  const filteredSongs = search
    ? songs.filter(song =>
        Object.values(song.tags).some(value => value.toLowerCase().includes(search.toLowerCase()))
      )
    : songs

  const pageCount = Math.max(1, Math.ceil(filteredSongs.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const pageSongs = filteredSongs.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  return (
    <div className="song-table">
      {addDialogId && onAddUrl && (
        <AddSongDialog
          id={addDialogId}
          onAddFile={onAddFile}
          onAddUrl={onAddUrl}
          onAdded={onAdded ?? (() => {})}
        />
      )}
      {songs.length > SEARCH_THRESHOLD && (
        <input
          type="search"
          className="form-control"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      )}
      <div className="library-table-container table-responsive">
        <table className="table table-striped">
          <thead>
            <tr>
              {columns.map(key => (
                <th key={key} className="text-capitalize">
                  {onRemoveColumn ? (
                    <ColumnHeaderMenu label={key} onDelete={() => onRemoveColumn(key)} />
                  ) : key}
                </th>
              ))}
              {onAddColumn && (
                <th>
                  <AddColumnDialog id={addColumnDialogId} existingColumns={columns} onAdd={onAddColumn} />
                </th>
              )}
              <th>Duration</th>
              {renderActions && <th></th>}
            </tr>
          </thead>
          <tbody>
            {pageSongs.map(song => (
              <tr key={song.id} className="library-row">
                {columns.map(key => (
                  onEditTag ? (
                    <EditableTagCell
                      key={key}
                      value={song.tags[key] ?? ''}
                      onSave={value => onEditTag(song, key, value)}
                    />
                  ) : (
                    <td key={key}>{song.tags[key] ?? ''}</td>
                  )
                ))}
                {onAddColumn && <td></td>}
                <td>{formatDuration(song.duration)}</td>
                {renderActions && (
                  <td className="library-row-actions">
                    {renderActions(song)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <nav>
          <ul className="pagination">
            <li className={`page-item${currentPage === 0 ? ' disabled' : ''}`}>
              <button type="button" className="page-link" onClick={() => setPage(currentPage - 1)}>
                Previous
              </button>
            </li>
            {getPageNumbers(currentPage, pageCount).map((i, index) => (
              i === 'ellipsis' ? (
                <li key={`ellipsis-${index}`} className="page-item disabled">
                  <span className="page-link">&hellip;</span>
                </li>
              ) : (
                <li key={i} className={`page-item${i === currentPage ? ' active' : ''}`}>
                  <button type="button" className="page-link" onClick={() => setPage(i)}>
                    {i + 1}
                  </button>
                </li>
              )
            ))}
            <li className={`page-item${currentPage === pageCount - 1 ? ' disabled' : ''}`}>
              <button type="button" className="page-link" onClick={() => setPage(currentPage + 1)}>
                Next
              </button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  )
}
