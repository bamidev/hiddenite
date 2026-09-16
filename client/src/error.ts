import { Toast } from 'bootstrap'

export type MessageType = 'error' | 'warning' | 'info'

const LEVEL_CLASSES: Record<MessageType, string> = {
  error: 'text-bg-danger',
  warning: 'text-bg-warning',
  info: 'text-bg-info',
}

const toasts = new Map<string, Toast>()

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
 * Creates a toast element and puts it on the page, without showing it yet.
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
 * Shows a toast that was previously put on the page with loadToast.
 */
export function showToast(id: string): void {
  toasts.get(id)?.show()
}


loadToast('no-active-queue', 'error', 'There is no active queue')
