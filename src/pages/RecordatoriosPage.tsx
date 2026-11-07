import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ConfigBanner } from '@/components/money/ConfigBanner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { usePlanData } from '@/hooks/usePlanData'
import {
  buildReminders,
  clearDismissedReminders,
  dismissReminder,
  filterActiveReminders,
  readDismissedReminderIds,
  requestBrowserNotificationPermission,
  showBrowserNotifications,
  type Reminder,
} from '@/lib/reminders'

export function RecordatoriosPage() {
  const plan = usePlanData()
  const [dismissed, setDismissed] = useState(() => readDismissedReminderIds())
  const [permMessage, setPermMessage] = useState<string | null>(null)

  const all = useMemo(
    () =>
      buildReminders({
        budgetWarnings: plan.budgetWarnings,
        recurringRules: plan.recurringRules,
        debts: plan.debts,
        goals: plan.goals,
        transactions: plan.transactions,
      }),
    [
      plan.budgetWarnings,
      plan.recurringRules,
      plan.debts,
      plan.goals,
      plan.transactions,
    ],
  )

  const active = useMemo(() => filterActiveReminders(all, dismissed), [all, dismissed])

  useEffect(() => {
    if (active.length === 0) return
    showBrowserNotifications(active)
  }, [active])

  function handleDismiss(reminder: Reminder) {
    dismissReminder(reminder.id)
    setDismissed(readDismissedReminderIds())
  }

  function handleClearDismissed() {
    clearDismissedReminders()
    setDismissed(new Set())
  }

  async function handleEnableBrowser() {
    const result = await requestBrowserNotificationPermission()
    if (result === 'unsupported') {
      setPermMessage('Este navegador no soporta notificaciones del sistema.')
    } else if (result === 'denied') {
      setPermMessage('Permiso denegado. Puedes activarlo en la configuración del navegador.')
    } else if (result === 'granted') {
      setPermMessage('Notificaciones del navegador activadas. Se mostrarán avisos al abrir la app.')
      showBrowserNotifications(active)
    } else {
      setPermMessage(null)
    }
  }

  return (
    <main className="page">
      <header className="page-header page-header-row">
        <div>
          <h1>Recordatorios</h1>
          <p>Límites, recurrentes próximos, vencimientos e inactividad.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void handleEnableBrowser()}>
          Activar avisos
        </Button>
      </header>

      <div className="stack-md">
        <ConfigBanner configured={plan.configured} error={plan.error} />
        <ErrorBanner message={permMessage} tone="info" />

        <Card>
          <p className="muted" style={{ margin: 0, fontSize: '0.875rem' }}>
            Los recordatorios se generan a partir de tus datos (sin servicio de push de pago).
            Puedes descartarlos en este dispositivo; «Activar avisos» usa la API del navegador
            si concedes permiso.
          </p>
        </Card>

        {plan.loading ? (
          <p className="muted">Cargando…</p>
        ) : active.length === 0 ? (
          <EmptyState
            title="Todo al día"
            description="No hay avisos activos. Cuando un límite se acerque o un pago esté cerca, aparecerá aquí."
            action={
              dismissed.size > 0 ? (
                <Button size="sm" variant="secondary" onClick={handleClearDismissed}>
                  Restaurar descartados
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="money-list">
            {active.map((item) => (
              <div key={item.id} className="money-row money-row-static money-row-stack">
                <span
                  className="money-dot"
                  style={{
                    background:
                      item.severity === 'danger'
                        ? 'var(--danger)'
                        : item.severity === 'warn'
                          ? '#EAB308'
                          : 'var(--accent)',
                  }}
                />
                <span className="money-row-main">
                  <strong>{item.title}</strong>
                  <span className="muted">{item.body}</span>
                  <span className="header-actions" style={{ marginTop: '0.5rem' }}>
                    <Link to={item.href} className="text-link">
                      Abrir
                    </Link>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => handleDismiss(item)}
                    >
                      Descartar
                    </button>
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        {dismissed.size > 0 && active.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={handleClearDismissed}>
            Restaurar {dismissed.size} descartado{dismissed.size === 1 ? '' : 's'}
          </Button>
        ) : null}
      </div>
    </main>
  )
}
