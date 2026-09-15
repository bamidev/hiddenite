import CloseButton from './common/close-button.tsx'
import AddButton from './common/add-button.tsx'
import EditableLabel from './common/editable-label.tsx'
import Queue, { type QueueData } from './queue.tsx'

export interface MixSourceData {
  id: string
  name: string
  queues?: QueueData[]
  playing: boolean
  currentSongId: string | null
  elapsedMs: number
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
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

export default function MixSource({ source, onClose, onRename, onAddQueue, onRenameQueue, onActivateQueue, onTogglePlay }: { source: MixSourceData, onClose: () => void, onRename: (name: string) => void, onAddQueue: () => void, onRenameQueue: (queueId: string, name: string) => void, onActivateQueue: (queueId: string) => void, onTogglePlay: () => void }) {
  const queues = source.queues ?? []

  return (
    <div className="mix-source">
      <CloseButton onClick={onClose} />
      <EditableLabel value={source.name} onChange={onRename} />
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onTogglePlay}>
        {source.playing ? 'Pause' : 'Play'}
      </button>
      {source.currentSongId && <span>{formatElapsed(source.elapsedMs)}</span>}

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
            <Queue queue={queue} />
          </div>
        ))}
      </div>
    </div>
  )
}
