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

export interface MixSourceData {
  id: string
  name: string
  queues?: QueueData[]
  playing: boolean
  currentSong: SongInfo | null
  elapsedMs: number
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

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

export default function MixSource({ source, folders, onClose, onRename, onAddQueue, onRenameQueue, onActivateQueue }: { source: MixSourceData, folders: LibraryFolder[], onClose: () => void, onRename: (name: string) => void, onAddQueue: () => void, onRenameQueue: (queueId: string, name: string) => void, onActivateQueue: (queueId: string) => void }) {
  const queues = source.queues ?? []
  const [playing, setPlaying] = useState(source.playing)
  const [currentSong, setCurrentSong] = useState(source.currentSong)
  const [elapsedMs, setElapsedMs] = useState(source.elapsedMs)
  const [songLoadedAt, setSongLoadedAt] = useState(() => Date.now())
  const remaining = useRemaining(elapsedMs, currentSong?.metadata.duration ?? null, playing)

  function handlePlayEvent(event: PlayPlaybackEvent) {
    setPlaying(true)
    setElapsedMs(event.elapsed)
  }

  function handlePauseEvent() {
    setPlaying(false)
  }

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
