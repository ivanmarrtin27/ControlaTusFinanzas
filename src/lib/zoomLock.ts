/**
 * Preferencia local para bloquear pinch / double-tap zoom (iPhone / PWA).
 * Default: ON (bloqueado). Solo se permite zoom si el usuario lo desactiva.
 */

export const ZOOM_LOCK_STORAGE_KEY = 'ctf-zoom-lock'

const VIEWPORT_LOCKED =
  'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
const VIEWPORT_OPEN =
  'width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover'

let gestureHandlersBound = false

function onGesture(event: Event) {
  event.preventDefault()
}

/** Sin clave en localStorage → bloqueado (default ON). */
export function readZoomLockEnabled(): boolean {
  try {
    const raw = localStorage.getItem(ZOOM_LOCK_STORAGE_KEY)
    if (raw == null) return true
    return raw !== '0'
  } catch {
    return true
  }
}

export function writeZoomLockEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ZOOM_LOCK_STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    // ignore quota / private mode
  }
}

function getViewportMeta(): HTMLMetaElement | null {
  return document.querySelector('meta[name="viewport"]')
}

function setGestureLock(locked: boolean): void {
  if (typeof document === 'undefined') return

  if (locked && !gestureHandlersBound) {
    document.addEventListener('gesturestart', onGesture, { passive: false })
    document.addEventListener('gesturechange', onGesture, { passive: false })
    gestureHandlersBound = true
  } else if (!locked && gestureHandlersBound) {
    document.removeEventListener('gesturestart', onGesture)
    document.removeEventListener('gesturechange', onGesture)
    gestureHandlersBound = false
  }
}

/** Aplica viewport + touch-action + gestos iOS según la preferencia. */
export function applyZoomLock(enabled: boolean): void {
  const meta = getViewportMeta()
  if (meta) {
    meta.setAttribute('content', enabled ? VIEWPORT_LOCKED : VIEWPORT_OPEN)
  }

  document.documentElement.classList.toggle('zoom-locked', enabled)
  document.body.style.touchAction = enabled ? 'manipulation' : ''

  setGestureLock(enabled)
}

export function setZoomLockEnabled(enabled: boolean): void {
  writeZoomLockEnabled(enabled)
  applyZoomLock(enabled)
}

/** Lee localStorage y aplica (default bloqueado). */
export function initZoomLockFromStorage(): void {
  applyZoomLock(readZoomLockEnabled())
}
