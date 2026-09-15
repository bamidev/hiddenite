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
  return (
    <div className="mix-source">
      <CloseButton onClick={onClose} />
      {source.name}
      <ul className="queue-list">
        {(source.queues ?? []).map(queue => (
          <li key={queue.id}>{queue.id}</li>
        ))}
      </ul>
      <AddButton onClick={onAddQueue} />
    </div>
  )
}
