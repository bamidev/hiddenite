/**
 * A single Bootstrap accordion item that can be expanded/collapsed by clicking its header.
 */

import type { ReactNode } from 'react'

/**
 * Renders a Bootstrap accordion item: a clickable header that toggles the visibility of
 * `children` below it.
 *
 * @param id - Unique DOM id for the section, used to wire up Bootstrap's collapse toggle
 *   (`data-bs-target`) and ARIA attributes between the header and body.
 * @param title - Text shown in the section's header button.
 * @param children - Content rendered inside the collapsible body.
 */
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
