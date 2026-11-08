import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconBell } from '@/components/layout/icons'
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
        <IconBell />
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
