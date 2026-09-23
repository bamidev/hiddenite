/**
 * A small "⋯" trigger button that opens a dropdown list of actions, closing itself when the
 * user clicks outside of it.
 */

import { useEffect, useRef, useState } from 'react'

/**
 * A single entry in an {@link ActionMenu}'s dropdown list.
 */
export interface ActionMenuAction {
  /** Text shown for this menu entry. */
  label: string
  /** Called when the entry is clicked; the menu closes automatically beforehand. */
  onClick: () => void
}

/**
 * Renders a "⋯" button that toggles a dropdown of clickable actions. The dropdown closes
 * automatically when the user clicks anywhere outside the menu.
 *
 * @param actions - The list of actions to show in the dropdown, in order.
 */
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
