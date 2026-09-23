/**
 * Manages Bootstrap toast notifications: builds toast DOM elements, tracks them by id so they
 * can be shown on demand, and registers the app's well-known toasts (e.g. "no active queue",
 * "autoplay blocked").
 */

import { Toast } from 'bootstrap'

/**
 * Severity level of a toast message, used to pick its Bootstrap background class.
 */
export type MessageType = 'error' | 'warning' | 'info'

const LEVEL_CLASSES: Record<MessageType, string> = {
  error: 'text-bg-danger',
  warning: 'text-bg-warning',
  info: 'text-bg-info',
}

const toasts = new Map<string, Toast>()

/**
 * Returns the shared fixed-position container element that toasts are appended to, creating
 * and inserting it into the document body the first time it's needed.
 */
function getContainer(): HTMLElement {
  let container = document.getElementById('toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'toast-container'
    container.className = 'toast-container position-fixed top-0 end-0 p-3'
    document.body.appendChild(container)
  }
  return container
}

/**
 * Creates a toast element and puts it on the page, without showing it yet. Replaces any
 * existing element with the same id.
 *
 * @param id - Unique id for the toast, used later to show it via {@link showToast}.
 * @param level - Severity level, which determines the toast's background color.
 * @param message - The text to display inside the toast body.
 */
export function loadToast(id: string, level: MessageType, message: string): void {
  document.getElementById(id)?.remove()

  const el = document.createElement('div')
  el.id = id
  el.className = `toast ${LEVEL_CLASSES[level]}`
  el.setAttribute('role', 'alert')
  el.setAttribute('aria-live', 'assertive')
  el.setAttribute('aria-atomic', 'true')

  const flex = document.createElement('div')
  flex.className = 'd-flex'

  const body = document.createElement('div')
  body.className = 'toast-body'
  body.textContent = message

  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className = 'btn-close btn-close-white me-2 m-auto'
  closeButton.setAttribute('data-bs-dismiss', 'toast')
  closeButton.setAttribute('aria-label', 'Close')

  flex.append(body, closeButton)
  el.append(flex)
  getContainer().append(el)

  toasts.set(id, new Toast(el))
}

/**
 * Shows a toast that was previously put on the page with loadToast. Does nothing if no toast
 * with the given id has been loaded.
 *
 * @param id - The id of the toast to show, as passed to {@link loadToast}.
 */
export function showToast(id: string): void {
  toasts.get(id)?.show()
}


loadToast('no-active-queue', 'error', 'There is no active queue')
loadToast('autoplay-blocked', 'warning', 'Unable to auto-start audio. Click anywhere.')
loadToast('library-rescan-failed', 'error', 'Library rescan failed')
