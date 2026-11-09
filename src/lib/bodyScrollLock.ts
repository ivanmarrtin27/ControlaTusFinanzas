/**
 * iOS Safari / PWA–friendly body scroll lock.
 * `overflow: hidden` alone still allows rubber-band scroll on iOS;
 * freezing the body with position:fixed + restoring scrollY is the reliable fix.
 *
 * Important: never preventDefault touchmove inside dialogs/sheets. Doing so when
 * the panel content does not overflow (or while typing in inputs) breaks taps and
 * form submit on iPhone.
 */

let lockCount = 0
let lockedScrollY = 0

type SavedStyles = {
  bodyPosition: string
  bodyTop: string
  bodyLeft: string
  bodyRight: string
  bodyWidth: string
  bodyOverflow: string
  htmlOverflow: string
  htmlOverscroll: string
}

let saved: SavedStyles | null = null

const INTERACTIVE_ROOT =
  '[role="dialog"], .sheet-panel, .notif-panel, .sheet-body, .notif-list'

function isInsideInteractiveSurface(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE_ROOT))
}

function onTouchMove(event: TouchEvent) {
  if (lockCount === 0) return
  // Allow all interaction inside sheets/dialogs/notification panels.
  if (isInsideInteractiveSurface(event.target)) return
  event.preventDefault()
}

export function lockBodyScroll() {
  if (typeof document === 'undefined') return

  lockCount += 1
  if (lockCount > 1) return

  const { body } = document
  const html = document.documentElement

  lockedScrollY = window.scrollY || window.pageYOffset || html.scrollTop || 0

  saved = {
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyLeft: body.style.left,
    bodyRight: body.style.right,
    bodyWidth: body.style.width,
    bodyOverflow: body.style.overflow,
    htmlOverflow: html.style.overflow,
    htmlOverscroll: html.style.overscrollBehavior,
  }

  body.style.position = 'fixed'
  body.style.top = `-${lockedScrollY}px`
  body.style.left = '0'
  body.style.right = '0'
  body.style.width = '100%'
  body.style.overflow = 'hidden'
  html.style.overflow = 'hidden'
  html.style.overscrollBehavior = 'none'

  document.addEventListener('touchmove', onTouchMove, { passive: false })
}

export function unlockBodyScroll() {
  if (typeof document === 'undefined' || lockCount === 0) return

  lockCount -= 1
  if (lockCount > 0) return

  document.removeEventListener('touchmove', onTouchMove)

  const { body } = document
  const html = document.documentElement
  const prev = saved
  saved = null

  if (prev) {
    body.style.position = prev.bodyPosition
    body.style.top = prev.bodyTop
    body.style.left = prev.bodyLeft
    body.style.right = prev.bodyRight
    body.style.width = prev.bodyWidth
    body.style.overflow = prev.bodyOverflow
    html.style.overflow = prev.htmlOverflow
    html.style.overscrollBehavior = prev.htmlOverscroll
  }

  window.scrollTo(0, lockedScrollY)
}
