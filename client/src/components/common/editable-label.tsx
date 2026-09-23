/**
 * A label that turns into a text input for editing on double-click, and commits the change
 * back out when the input loses focus.
 */

import { useState } from 'react'
import type { ElementType } from 'react'

/**
 * Renders `value` as static text (using the `as` element type, `span` by default). Double-clicking
 * switches to an editable text input; blurring the input calls `onChange` with the new value and
 * switches back to display mode. Any extra props are spread onto the rendered element (both the
 * display element and the input while editing).
 *
 * @param as - The element/component to render the value with when not editing. Defaults to `span`.
 * @param value - The current text value to display, and to prefill the input with when editing.
 * @param onChange - Called with the input's value when the user finishes editing (on blur).
 * @param props - Any other props are forwarded to the underlying element/input (e.g. `className`, ARIA attributes).
 */
export default function EditableLabel({ as, value, onChange, ...props }: { as?: ElementType, value: string, onChange: (value: string) => void, [key: string]: unknown }) {
  const [editing, setEditing] = useState(false)
  const Tag = as ?? 'span'

  if (editing) {
    return (
      <input
        {...props}
        type="text"
        autoFocus
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
      />
    )
  }

  return (
    <Tag {...props} onDoubleClick={() => setEditing(true)}>
      {value}
    </Tag>
  )
}
