import { useState } from 'react'
import type { ElementType } from 'react'

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
