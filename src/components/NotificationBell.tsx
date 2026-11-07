import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlanData } from '@/hooks/usePlanData'
import {
  buildReminders,
  filterActiveReminders,
  readDismissedReminderIds,
  showBrowserNotifications,
} from '@/lib/reminders'

export function NotificationBell() {
  const plan = usePlanData()
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(() => readDismissedReminderIds())

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

  const count = reminders.length

  return (
    <div className="notif-bell-wrap">
      <button
        type="button"
        className="notif-bell"
        aria-label={count > 0 ? `${count} recordatorios` : 'Recordatorios'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M6 9a6 6 0 1 1 12 0c0 3.5 1.5 5 1.5 5H4.5S6 12.5 6 9Z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {count > 0 ? <span className="notif-badge">{count > 9 ? '9+' : count}</span> : null}
      </button>

      {open ? (
        <div className="notif-panel" role="dialog" aria-label="Centro de notificaciones">
          <div className="notif-panel-head">
            <strong>Avisos</strong>
            <Link to="/recordatorios" className="text-link" onClick={() => setOpen(false)}>
              Ver todos
            </Link>
          </div>
          {count === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              Sin avisos pendientes.
            </p>
          ) : (
            <ul className="notif-list">
              {reminders.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <Link to={r.href} onClick={() => setOpen(false)}>
                    <strong>{r.title}</strong>
                    <span className="muted">{r.body}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
