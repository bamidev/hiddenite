import CloseButton from './common/close-button.tsx'
import AddButton from './common/add-button.tsx'

export interface QueueData {
  id: string
}

export interface MixSourceData {
  id: string
  name: string
  queues?: QueueData[]
}

export default function MixSource({ source, onClose, onAddQueue }: { source: MixSourceData, onClose: () => void, onAddQueue: () => void }) {
  const queues = source.queues ?? []

  return (
    <div className="mix-source">
      <CloseButton onClick={onClose} />
      {source.name}

      <ul className="nav nav-tabs" role="tablist">
        {queues.map((queue, i) => (
          <li className="nav-item" role="presentation" key={queue.id}>
            <button
              className={`nav-link${i === 0 ? ' active' : ''}`}
              id={`queue-tab-${source.id}-${queue.id}`}
              data-bs-toggle="tab"
              data-bs-target={`#queue-pane-${source.id}-${queue.id}`}
              type="button"
              role="tab"
              aria-controls={`queue-pane-${source.id}-${queue.id}`}
              aria-selected={i === 0}
            >
              {queue.id}
            </button>
          </li>
        ))}
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
            Queue {queue.id}
          </div>
        ))}
      </div>

      <AddButton onClick={onAddQueue} />
    </div>
  )
}
