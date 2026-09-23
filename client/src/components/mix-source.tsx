/**
 * A "mix source": a server-side playback state machine that plays through one of several
 * queues. This file renders a mix source's controls (play/pause, rename, close), its currently
 * playing song, and its tabbed list of queues, and keeps local state in sync with the server via
 * server-sent events.
 */

import { useEffect, useState } from 'react'
import type { NewPlaybackEvent, PlayPlaybackEvent, PlaybackEvent, SongInfo } from 'hiddenite'
import { api } from '../api.ts'
import CloseButton from './common/close-button.tsx'
import AddButton from './common/add-button.tsx'
import EditableLabel from './common/editable-label.tsx'
import Queue, { type QueueData } from './queue.tsx'
import SongPlayer from './song-player.tsx'
import NowPlaying from './now-playing.tsx'
import type { LibraryFolder } from './consolidated-library.tsx'

/**
 * Server-side state of a mix source, as returned by the `mix-source` endpoints and pushed via
 * its server-sent event stream.
 */
export interface MixSourceData {
  id: string
  name: string
  /** The source's queues. May be absent/empty if none have been created yet. */
  queues?: QueueData[]
  /** Whether the source is currently playing. */
  playing: boolean
  /** The song currently loaded into the source, or `null` if nothing is loaded. */
  currentSong: SongInfo | null
  /** Milliseconds elapsed into `currentSong` as of the last known state update. */
  elapsedMs: number
}

/**
 * Formats a millisecond duration as `minutes:seconds` (e.g. `3:07`).
 *
 * @param ms - Duration in milliseconds.
 * @returns The formatted `m:ss` string.
 */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Tracks the remaining playback time for the current song, counting down locally once per
 * second while playing so the UI doesn't need a server round-trip every tick. Resyncs whenever
 * `elapsedMs` or `duration` changes (e.g. on a server update or song change).
 *
 * @param elapsedMs - The last known elapsed time in milliseconds, used to reset the countdown.
 * @param duration - Total duration of the current song in milliseconds, or `null` if unknown
 *   (in which case remaining time can't be computed).
 * @param playing - Whether playback is currently active; the countdown only ticks while `true`.
 * @returns The remaining time in milliseconds, or `null` if `duration` is unknown.
 */
function useRemaining(elapsedMs: number, duration: number | null, playing: boolean): number | null {
  const [remaining, setRemaining] = useState(duration != null ? duration - elapsedMs : null)

  useEffect(() => {
    setRemaining(duration != null ? duration - elapsedMs : null)
  }, [elapsedMs, duration])

  useEffect(() => {
    if (!playing || duration == null) return
    const interval = setInterval(() => {
      setRemaining(r => r != null ? Math.max(0, r - 1000) : null)
    }, 1000)
    return () => clearInterval(interval)
  }, [playing, duration])

  return remaining
}

/**
 * Renders a single Bootstrap nav-tab for one of a mix source's queues, with an editable label
 * (double-click to rename) and a click handler to mark the queue active.
 *
 * @param sourceId - Id of the owning mix source, used to build unique tab/pane DOM ids.
 * @param queue - The queue this tab represents.
 * @param active - Whether this tab is the initially-selected/active Bootstrap tab.
 * @param onRename - Called with the new name when the tab's label is edited.
 * @param onActivate - Called when the tab is clicked, to mark this queue as the active one.
 */
function QueueTab({ sourceId, queue, active, onRename, onActivate }: { sourceId: string, queue: QueueData, active: boolean, onRename: (name: string) => void, onActivate: () => void }) {
  return (
    <li className="nav-item" role="presentation">
      <EditableLabel
        as="a"
        className={`nav-link${active ? ' active' : ''}`}
        id={`queue-tab-${sourceId}-${queue.id}`}
        data-bs-toggle="tab"
        data-bs-target={`#queue-pane-${sourceId}-${queue.id}`}
        type="button"
        role="tab"
        aria-controls={`queue-pane-${sourceId}-${queue.id}`}
        aria-selected={active}
        value={queue.name}
        onChange={onRename}
        onClick={onActivate}
      />
    </li>
  )
}

/**
 * Renders a single mix source: its close/rename controls, play/pause button, the currently
 * playing song (via `NowPlaying` and `SongPlayer`), and a tabbed list of its queues. Subscribes
 * to the mix source's server-sent event stream to keep playback state (playing, current song,
 * elapsed time) in sync with the server.
 *
 * @param source - The mix source's initial state, used to seed local playback state.
 * @param folders - Remote library folders, forwarded to `Queue` for its auto-add folder picker.
 * @param onClose - Called when the close button is clicked, to remove this mix source.
 * @param onRename - Called with the new name when the source's label is edited.
 * @param onAddQueue - Called when the "add queue" button is clicked.
 * @param onRenameQueue - Called with a queue id and new name when one of the source's queue tabs is renamed.
 * @param onActivateQueue - Called with a queue id when one of the source's queue tabs is activated.
 */
export default function MixSource({ source, folders, onClose, onRename, onAddQueue, onRenameQueue, onActivateQueue }: { source: MixSourceData, folders: LibraryFolder[], onClose: () => void, onRename: (name: string) => void, onAddQueue: () => void, onRenameQueue: (queueId: string, name: string) => void, onActivateQueue: (queueId: string) => void }) {
  const queues = source.queues ?? []
  const [playing, setPlaying] = useState(source.playing)
  const [currentSong, setCurrentSong] = useState(source.currentSong)
  const [elapsedMs, setElapsedMs] = useState(source.elapsedMs)
  const [songLoadedAt, setSongLoadedAt] = useState(() => Date.now())
  const remaining = useRemaining(elapsedMs, currentSong?.metadata.duration ?? null, playing)

  /**
   * Applies a `play` server-sent event: marks playback as active and resyncs elapsed time.
   *
   * @param event - The play event received from the server.
   */
  function handlePlayEvent(event: PlayPlaybackEvent) {
    setPlaying(true)
    setElapsedMs(event.elapsed)
  }

  /**
   * Applies a `pause` server-sent event: marks playback as inactive.
   */
  function handlePauseEvent() {
    setPlaying(false)
  }

  /**
   * Applies a `new` server-sent event (a new song was loaded into the source): updates the
   * current song and elapsed time, resets the "song loaded at" timestamp (used as a cache-buster
   * for the audio stream URL), and notifies queue components that a song was taken from a queue.
   *
   * @param event - The new-song event received from the server.
   */
  function handleNewEvent(event: NewPlaybackEvent) {
    setPlaying(true)
    setCurrentSong(event.song)
    setElapsedMs(event.elapsed)
    setSongLoadedAt(Date.now())
    window.dispatchEvent(new CustomEvent('queue-song-taken', { detail: { queueId: event.queueId } }))
  }

  useEffect(() => {
    const eventSource = new EventSource(`${api.baseUrl}/mix-source/${source.id}/events`)
    eventSource.onmessage = e => {
      const event: PlaybackEvent = JSON.parse(e.data)
      if (event.event === 'play') handlePlayEvent(event as PlayPlaybackEvent)
      else if (event.event === 'pause') handlePauseEvent()
      else if (event.event === 'new') handleNewEvent(event as NewPlaybackEvent)
    }
    return () => eventSource.close()
  }, [source.id])

  /**
   * Tells the server to toggle play/pause for this mix source. Local `playing` state is updated
   * separately, via the resulting server-sent event.
   */
  function onTogglePlay() {
    api.post(`mix-source/${source.id}/play`)
  }

  return (
    <div className="mix-source">
      <CloseButton onClick={onClose} />
      <EditableLabel value={source.name} onChange={onRename} />
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onTogglePlay}>
        {playing ? 'Pause' : 'Play'}
      </button>
      {currentSong && (
        <>
          <NowPlaying tags={currentSong.metadata.tags} />
          <span>{remaining != null ? `-${formatElapsed(remaining)}` : formatElapsed(elapsedMs)}</span>
          <SongPlayer
            key={currentSong.id}
            currentSong={currentSong}
            mixSourceId={source.id}
            elapsedMs={elapsedMs}
            playing={playing}
            cacheBuster={songLoadedAt}
          />
        </>
      )}

      <ul className="nav nav-tabs" role="tablist">
        {queues.map((queue, i) => (
          <QueueTab
            key={queue.id}
            sourceId={source.id}
            queue={queue}
            active={i === 0}
            onRename={name => onRenameQueue(queue.id, name)}
            onActivate={() => onActivateQueue(queue.id)}
          />
        ))}
        <li className="nav-item">
          <AddButton onClick={onAddQueue} />
        </li>
      </ul>
      <div className="tab-content">
        {queues.map((queue, i) => (
          <div
            className={`tab-pane fade${i === 0 ? ' show active' : ''}`}
            id={`queue-pane-${source.id}-${queue.id}`}
            role="tabpanel"
            aria-labelledby={`queue-tab-${source.id}-${queue.id}`}
            key={queue.id}
          >
            <Queue queue={queue} folders={folders} />
          </div>
        ))}
      </div>
    </div>
  )
}
