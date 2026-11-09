import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { lockBodyScroll, unlockBodyScroll } from '@/lib/bodyScrollLock'

interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Pin the overlay to the visual viewport so iOS keyboard open/close does not
 * yank `position: fixed` sheets (layout viewport stays put; VV offset moves).
 */
function pinSheetToVisualViewport(root: HTMLElement) {
  const vv = window.visualViewport
  if (!vv) {
    root.style.top = '0px'
    root.style.left = '0px'
    root.style.width = '100%'
    root.style.height = '100%'
    return
  }
  root.style.top = `${Math.round(vv.offsetTop)}px`
  root.style.left = `${Math.round(vv.offsetLeft)}px`
  root.style.width = `${Math.round(vv.width)}px`
  root.style.height = `${Math.round(vv.height)}px`
}

/** Scroll only inside `.sheet-body` — never call scrollIntoView (moves the page on iOS). */
function scrollFieldIntoSheetBody(target: HTMLElement) {
  const scroller = target.closest('.sheet-body')
  if (!(scroller instanceof HTMLElement)) return

  const scrollerRect = scroller.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const edge = 16

  if (targetRect.bottom > scrollerRect.bottom - edge) {
    scroller.scrollTop += targetRect.bottom - (scrollerRect.bottom - edge)
  } else if (targetRect.top < scrollerRect.top + edge) {
    scroller.scrollTop -= scrollerRect.top + edge - targetRect.top
  }
}

function clearSheetViewportStyles(root: HTMLElement) {
  root.style.removeProperty('top')
  root.style.removeProperty('left')
  root.style.removeProperty('width')
  root.style.removeProperty('height')
}

export function Sheet({ open, title, onClose, children, footer }: SheetProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  onCloseRef.current = onClose

  // Only re-run when `open` changes. Callers pass inline onClose lambdas; putting
  // onClose in deps re-ran the trap on every keystroke and stole focus from inputs.
  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    const root = rootRef.current
    const panel = panelRef.current
    const focusables = panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : []
    // Prefer the first field, not the header "Cerrar" button.
    const firstField =
      focusables.find((el) => {
        const tag = el.tagName
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      }) ?? focusables[0] ?? panel
    firstField?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panel) return

      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
      )
      if (nodes.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }
      const firstNode = nodes[0]
      const lastNode = nodes[nodes.length - 1]
      if (!firstNode || !lastNode) return

      if (event.shiftKey && document.activeElement === firstNode) {
        event.preventDefault()
        lastNode.focus()
      } else if (!event.shiftKey && document.activeElement === lastNode) {
        event.preventDefault()
        firstNode.focus()
      }
    }

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (!panel?.contains(target)) return
      // Keep the field visible inside the sheet scroller only (no window scroll).
      requestAnimationFrame(() => scrollFieldIntoSheetBody(target))
      // iOS keyboard animation finishes later; nudge again without touching document scroll.
      window.setTimeout(() => scrollFieldIntoSheetBody(target), 280)
    }

    const onAnimEnd = (event: AnimationEvent) => {
      if (!panel || event.target !== panel) return
      // `animation-fill-mode: both` leaves transform applied, which breaks sticky
      // children and can confuse iOS hit-testing. Clear it after the enter finishes.
      panel.style.animation = 'none'
      panel.style.transform = 'none'
    }

    const syncViewport = () => {
      if (root) pinSheetToVisualViewport(root)
    }

    syncViewport()
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', syncViewport)
    viewport?.addEventListener('scroll', syncViewport)
    window.addEventListener('resize', syncViewport)

    document.addEventListener('keydown', onKey)
    document.addEventListener('focusin', onFocusIn)
    panel?.addEventListener('animationend', onAnimEnd)
    lockBodyScroll()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', onFocusIn)
      panel?.removeEventListener('animationend', onAnimEnd)
      viewport?.removeEventListener('resize', syncViewport)
      viewport?.removeEventListener('scroll', syncViewport)
      window.removeEventListener('resize', syncViewport)
      if (root) clearSheetViewportStyles(root)
      // Ensure any legacy global inset from older builds is cleared.
      document.documentElement.style.setProperty('--keyboard-inset', '0px')
      unlockBodyScroll()
      previouslyFocused.current?.focus?.()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div ref={rootRef} className="sheet-root" role="presentation">
      <button type="button" className="sheet-backdrop" aria-label="Cerrar panel" onClick={onClose} />
      <div
        ref={panelRef}
        className="sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="sheet-header">
          <h2 id={titleId}>{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar panel">
            Cerrar
          </Button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer ? <footer className="sheet-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  )
}
