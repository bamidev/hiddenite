import type { ReactNode } from 'react'

export default function CollapsibleSection({ id, title, children }: { id: string, title: string, children: ReactNode }) {
  return (
    <div className="collapsible-section">
      <button
        type="button"
        className="btn btn-link collapsible-section-toggle"
        data-bs-toggle="collapse"
        data-bs-target={`#${id}`}
        aria-expanded="true"
        aria-controls={id}
      >
        {title}
      </button>
      <div className="collapse show" id={id}>
        {children}
      </div>
    </div>
  )
}
