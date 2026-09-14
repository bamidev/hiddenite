import { useEffect, useRef, useState } from 'react'

export interface ActionMenuAction {
  label: string
  onClick: () => void
}

export default function ActionMenu({ actions }: { actions: ActionMenuAction[] }) {
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
    <div className="action-menu" ref={ref}>
      <button className="action-menu-trigger" onClick={() => setOpen(o => !o)}>
        ⋯
      </button>
      {open && (
        <div className="action-menu-list">
          {actions.map(action => (
            <button
              key={action.label}
              className="action-menu-item"
              onClick={() => {
                setOpen(false)
                action.onClick()
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
