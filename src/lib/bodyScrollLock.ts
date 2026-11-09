/**
 * iOS Safari / PWA–friendly body scroll lock.
 * `overflow: hidden` alone still allows rubber-band scroll on iOS;
 * freezing the body with position:fixed + restoring scrollY is the reliable fix.
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

function isScrollable(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el)
  const overflowY = style.overflowY
  if (overflowY !== 'auto' && overflowY !== 'scroll' && overflowY !== 'overlay') return false
  return el.scrollHeight > el.clientHeight
}

function findScrollableAncestor(target: EventTarget | null): HTMLElement | null {
  let node = target instanceof HTMLElement ? target : null
  while (node && node !== document.body && node !== document.documentElement) {
    if (isScrollable(node)) return node
    node = node.parentElement
  }
  return null
}

function onTouchMove(event: TouchEvent) {
  if (lockCount === 0) return
  // Allow scrolling inside sheet/modal panels; block background rubber-banding.
  if (findScrollableAncestor(event.target)) return
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
