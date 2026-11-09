import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { IconBell } from '@/components/layout/icons'
import { usePlanData } from '@/hooks/usePlanData'
import { lockBodyScroll, unlockBodyScroll } from '@/lib/bodyScrollLock'
import {
  buildReminders,
  filterActiveReminders,
  readDismissedReminderIds,
  showBrowserNotifications,
  type ReminderKind,
} from '@/lib/reminders'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const KIND_LABEL: Record<ReminderKind, string> = {
  budget: 'Límite',
  recurring: 'Recurrente',
  calendar: 'Agenda',
  inactivity: 'Inactividad',
}

const CLOSE_MS = 280

export function NotificationBell() {
  const plan = usePlanData()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({})
  const [dismissed, setDismissed] = useState(() => readDismissedReminderIds())

  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const panelId = useId()

  const reminders = useMemo(() => {
    const all = buildReminders({
      budgetWarnings: plan.budgetWarnings,
      recurringRules: plan.recurringRules,
      debts: plan.debts,
      goals: plan.goals,
      transactions: plan.transactions,
    })
    return filterActiveReminders(all, dismissed)
  }, [
    plan.budgetWarnings,
    plan.recurringRules,
    plan.debts,
    plan.goals,
    plan.transactions,
    dismissed,
  ])

  useEffect(() => {
    setDismissed(readDismissedReminderIds())
  }, [plan.lastSyncedAt])

  useEffect(() => {
    if (reminders.length === 0) return
    showBrowserNotifications(reminders)
  }, [reminders])

  useEffect(() => {
    if (open) {
      setMounted(true)
      const frame = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(frame)
    }
    setVisible(false)
    const timer = window.setTimeout(() => setMounted(false), CLOSE_MS)
    return () => window.clearTimeout(timer)
  }, [open])

  useLayoutEffect(() => {
    if (!mounted) return

    function placePanel() {
      const anchor = buttonRef.current
      if (!anchor) return

      const rect = anchor.getBoundingClientRect()
      const narrow = window.matchMedia('(max-width: 719px)').matches
      const margin = 12
      const rootStyles = getComputedStyle(document.documentElement)
      const safeLeft = Number.parseFloat(rootStyles.getPropertyValue('--safe-left')) || 0
      const safeRight = Number.parseFloat(rootStyles.getPropertyValue('--safe-right')) || 0

      if (narrow) {
        setPanelStyle({
          top: 'var(--top-bar-offset)',
          left: `max(${margin}px, var(--safe-left))`,
          right: `max(${margin}px, var(--safe-right))`,
          width: 'auto',
          maxWidth: 'none',
        })
        return
      }

      const width = Math.min(22 * 16, window.innerWidth - margin * 2 - safeLeft - safeRight)
      let left = rect.right - width
      const minLeft = margin + safeLeft
      const maxLeft = window.innerWidth - width - margin - safeRight
      left = Math.max(minLeft, Math.min(left, maxLeft))

      setPanelStyle({
        top: Math.min(rect.bottom + 8, window.innerHeight - margin),
        left,
        right: 'auto',
        width,
        maxWidth: width,
      })
    }

    placePanel()
    window.addEventListener('resize', placePanel)
    window.addEventListener('scroll', placePanel, true)
    return () => {
      window.removeEventListener('resize', placePanel)
      window.removeEventListener('scroll', placePanel, true)
    }
  }, [mounted])

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const focusables = panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : []
    const first = focusables[0] ?? panel
    first?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
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

    document.addEventListener('keydown', onKey)
    lockBodyScroll()
    return () => {
      document.removeEventListener('keydown', onKey)
      unlockBodyScroll()
      previouslyFocused.current?.focus?.()
    }
  }, [open])

  const count = reminders.length
  const preview = reminders.slice(0, 8)

  function close() {
    setOpen(false)
  }

  return (
    <div className="notif-bell-wrap">
      <button
        ref={buttonRef}
        type="button"
        className={`notif-bell${count > 0 ? ' has-alerts' : ''}`}
        aria-label={count > 0 ? `${count} recordatorios` : 'Recordatorios'}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <IconBell />
        {count > 0 ? (
          <span className="notif-badge" aria-hidden>
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </button>

      {mounted
        ? createPortal(
            <div className={`notif-root${visible ? ' is-open' : ''}`} role="presentation">
              <button
                type="button"
                className="notif-backdrop"
                aria-label="Cerrar avisos"
                onClick={close}
              />
              <div
                ref={panelRef}
                id={panelId}
                className="notif-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                style={panelStyle}
              >
                <div className="notif-panel-head">
                  <div className="notif-panel-title">
                    <strong id={titleId}>Avisos</strong>
                    {count > 0 ? <span className="notif-count-chip">{count}</span> : null}
                  </div>
                  <div className="notif-panel-actions">
                    <Link to="/recordatorios" className="text-link" onClick={close}>
                      Ver todos
                    </Link>
                    <button type="button" className="notif-close" onClick={close} aria-label="Cerrar">
                      ×
                    </button>
                  </div>
                </div>

                {count === 0 ? (
                  <div className="notif-empty" role="status">
                    <strong>Todo al día</strong>
                    <p className="muted">No hay avisos pendientes ahora mismo.</p>
                  </div>
                ) : (
                  <ul className="notif-list">
                    {preview.map((r) => (
                      <li key={r.id} className={`notif-item notif-item-${r.severity}`}>
                        <Link to={r.href} onClick={close}>
                          <span className="notif-item-dot" aria-hidden />
                          <span className="notif-item-copy">
                            <span className="notif-item-meta">
                              <span className="notif-item-kind">{KIND_LABEL[r.kind]}</span>
                            </span>
                            <strong>{r.title}</strong>
                            <span className="muted">{r.body}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                {count > preview.length ? (
                  <p className="notif-more muted">
                    +{count - preview.length} más en Recordatorios
                  </p>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
