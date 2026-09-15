import { useState } from 'react'
import { api } from '../api.ts'

export interface QueueData {
  id: string
  name: string
  shuffle: boolean
  repeat: boolean
}

export default function Queue({ queue }: { queue: QueueData }) {
  const [shuffle, setShuffle] = useState(queue.shuffle)
  const [repeat, setRepeat] = useState(queue.repeat)

  async function onToggleShuffle() {
    const response = await api.post(`queue/${queue.id}/shuffle`)
    const updated: QueueData = await response.json()
    setShuffle(updated.shuffle)
  }

  async function onToggleRepeat() {
    const response = await api.post(`queue/${queue.id}/repeat`)
    const updated: QueueData = await response.json()
    setRepeat(updated.repeat)
  }

  return (
    <>
      <button
        type="button"
        className={`btn btn-sm ${shuffle ? 'btn-primary' : 'btn-outline-secondary'}`}
        onClick={onToggleShuffle}
      >
        Shuffle
      </button>
      <button
        type="button"
        className={`btn btn-sm ${repeat ? 'btn-primary' : 'btn-outline-secondary'}`}
        onClick={onToggleRepeat}
      >
        Repeat
      </button>
    </>
  )
}
