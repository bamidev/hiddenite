import { useRef, useState } from 'react'
import { Modal } from 'bootstrap'
import { detectSongKind, type SongKind } from '../song-kind.ts'

export default function AddSongDialog({ id, onAddFile, onAddUrl, onAdded }: {
  id: string
  onAddFile?: (file: File) => Promise<void>
  onAddUrl: (kind: SongKind, url: string) => Promise<void>
  onAdded: () => void
}) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  function closeModal() {
    if (modalRef.current) {
      Modal.getInstance(modalRef.current)?.hide()
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !onAddFile) return
    await onAddFile(file)
    e.target.value = ''
    onAdded()
    closeModal()
  }

  async function onSubmitUrl() {
    const kind = detectSongKind(url)
    if (!kind) {
      setError('Only Bandcamp and YouTube URLs are supported.')
      return
    }
    setError('')
    await onAddUrl(kind, url)
    setUrl('')
    onAdded()
    closeModal()
  }

  return (
    <>
      <button type="button" className="btn btn-sm btn-outline-secondary" data-bs-toggle="modal" data-bs-target={`#${id}`}>
        Add song
      </button>

      <div className="modal fade" id={id} tabIndex={-1} ref={modalRef}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Add song</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              {onAddFile && (
                <div className="mb-3">
                  <label className="form-label">From a local file</label>
                  <input type="file" className="form-control" accept="audio/*" onChange={onFileChange} />
                </div>
              )}
              <div className="mb-3">
                <label className="form-label">From a URL (Bandcamp or YouTube)</label>
                <div className="input-group">
                  <input
                    type="url"
                    className="form-control"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://..."
                  />
                  <button type="button" className="btn btn-primary" onClick={onSubmitUrl}>
                    Add
                  </button>
                </div>
                {error && <div className="text-danger mt-1">{error}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
