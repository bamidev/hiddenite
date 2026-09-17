import type { ReactNode } from 'react'

export default function CollapsibleSection({ id, title, children }: { id: string, title: string, children: ReactNode }) {
  return (
    <div className="accordion-item">
      <h2 className="accordion-header">
        <button
          type="button"
          className="accordion-button"
          data-bs-toggle="collapse"
          data-bs-target={`#${id}`}
          aria-expanded="true"
          aria-controls={id}
        >
          {title}
        </button>
      </h2>
      <div id={id} className="accordion-collapse collapse show">
        <div className="accordion-body">
          {children}
        </div>
      </div>
    </div>
  )
}
