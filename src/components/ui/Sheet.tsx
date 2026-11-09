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

function syncKeyboardInset() {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  const viewport = window.visualViewport
  if (!viewport) {
    root.style.setProperty('--keyboard-inset', '0px')
    return
  }
  // Layout viewport height minus visible viewport → approximate soft keyboard.
  const occluded = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
  root.style.setProperty('--keyboard-inset', `${Math.round(occluded)}px`)
}

export function Sheet({ open, title, onClose, children, footer }: SheetProps) {
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
      // Keep focused controls visible above the iOS keyboard.
      window.setTimeout(() => {
        target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
      }, 50)
    }

    const onAnimEnd = (event: AnimationEvent) => {
      if (!panel || event.target !== panel) return
      // `animation-fill-mode: both` leaves transform applied, which breaks sticky
      // children and can confuse iOS hit-testing. Clear it after the enter finishes.
      panel.style.animation = 'none'
      panel.style.transform = 'none'
    }

    syncKeyboardInset()
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', syncKeyboardInset)
    viewport?.addEventListener('scroll', syncKeyboardInset)
    window.addEventListener('resize', syncKeyboardInset)

    document.addEventListener('keydown', onKey)
    document.addEventListener('focusin', onFocusIn)
    panel?.addEventListener('animationend', onAnimEnd)
    lockBodyScroll()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', onFocusIn)
      panel?.removeEventListener('animationend', onAnimEnd)
      viewport?.removeEventListener('resize', syncKeyboardInset)
      viewport?.removeEventListener('scroll', syncKeyboardInset)
      window.removeEventListener('resize', syncKeyboardInset)
      document.documentElement.style.setProperty('--keyboard-inset', '0px')
      unlockBodyScroll()
      previouslyFocused.current?.focus?.()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="sheet-root" role="presentation">
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
