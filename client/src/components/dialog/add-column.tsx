import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Modal } from 'bootstrap'

const COMMON_TAG_NAMES = ['artist', 'album', 'title', 'rating', 'genre', 'year', 'composer', 'comment', 'bpm', 'track']
const CUSTOM_OPTION = '__custom__'

export default function AddColumnDialog({ id, existingColumns, onAdd }: {
  id: string
  existingColumns: string[]
  onAdd: (name: string) => void
}) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<string>(COMMON_TAG_NAMES[0])
  const [custom, setCustom] = useState('')
  const [error, setError] = useState('')

  function closeModal() {
    if (modalRef.current) {
      Modal.getInstance(modalRef.current)?.hide()
    }
  }

  function onSubmit() {
    const name = (selected === CUSTOM_OPTION ? custom : selected).trim()
    if (!name) {
      setError('Enter a column name.')
      return
    }
    if (existingColumns.includes(name)) {
      setError('That column already exists.')
      return
    }
    setError('')
    setCustom('')
    onAdd(name)
    closeModal()
  }

  return (
    <>
      <button type="button" className="add-button" data-bs-toggle="modal" data-bs-target={`#${id}`}>+</button>

      {createPortal(
        <div className="modal fade" id={id} tabIndex={-1} ref={modalRef}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add column</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Tag name</label>
                  <select className="form-select" value={selected} onChange={e => setSelected(e.target.value)}>
                    {COMMON_TAG_NAMES.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                    <option value={CUSTOM_OPTION}>Custom...</option>
                  </select>
                </div>
                {selected === CUSTOM_OPTION && (
                  <div className="mb-3">
                    <input
                      type="text"
                      className="form-control"
                      value={custom}
                      onChange={e => setCustom(e.target.value)}
                      placeholder="Tag name"
                      autoFocus
                    />
                  </div>
                )}
                {error && <div className="text-danger mb-3">{error}</div>}
                <button type="button" className="btn btn-primary" onClick={onSubmit}>Add</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
