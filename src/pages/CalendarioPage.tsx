import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ConfigBanner } from '@/components/money/ConfigBanner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/contexts/AuthContext'
import { usePlanData } from '@/hooks/usePlanData'
import {
  buildCalendarEvents,
  eventsByDate,
  monthMatrix,
} from '@/lib/calendar'
import { formatMoney } from '@/lib/currency'
import { formatShortDate } from '@/lib/dates'
import { formatDateOnly } from '@/lib/planning'

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export function CalendarioPage() {
  const { profile } = useAuth()
  const currency = profile?.currency ?? 'EUR'
  const plan = usePlanData()
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selected, setSelected] = useState(() => formatDateOnly(new Date()))

  const events = useMemo(() => {
    const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59)
    return buildCalendarEvents({
      recurringRules: plan.recurringRules,
      debts: plan.debts,
      goals: plan.goals,
      from,
      to,
    })
  }, [plan.recurringRules, plan.debts, plan.goals, cursor])

  const byDate = useMemo(() => eventsByDate(events), [events])
  const cells = useMemo(() => monthMatrix(cursor), [cursor])
  const selectedEvents = byDate.get(selected) ?? []

  const upcoming = useMemo(() => {
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    const to = new Date(from)
    to.setDate(to.getDate() + 45)
    return buildCalendarEvents({
      recurringRules: plan.recurringRules,
      debts: plan.debts,
      goals: plan.goals,
      from,
      to,
    }).slice(0, 12)
  }, [plan.recurringRules, plan.debts, plan.goals])

  const monthLabel = cursor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  function shiftMonth(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1))
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>Calendario</h1>
        <p className="page-header-lead">Recurrentes, deudas y objetivos.</p>
      </header>

      <div className="stack-md">
        <ConfigBanner configured={plan.configured} error={plan.error} />

        <Card>
          <div className="section-head">
            <h2 style={{ fontSize: '1rem', margin: 0, textTransform: 'capitalize' }}>
              {monthLabel}
            </h2>
            <div className="header-actions">
              <Button size="sm" variant="secondary" onClick={() => shiftMonth(-1)} aria-label="Mes anterior">
                ‹
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const now = new Date()
                  setCursor(new Date(now.getFullYear(), now.getMonth(), 1))
                  setSelected(formatDateOnly(now))
                }}
              >
                Hoy
              </Button>
              <Button size="sm" variant="secondary" onClick={() => shiftMonth(1)} aria-label="Mes siguiente">
                ›
              </Button>
            </div>
          </div>

          <div className="cal-weekdays" aria-hidden>
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="cal-grid" role="grid" aria-label="Calendario del mes">
            {cells.map((cell) => {
              const key = formatDateOnly(cell.date)
              const dayEvents = byDate.get(key) ?? []
              const isSelected = key === selected
              const isToday = key === formatDateOnly(new Date())
              return (
                <button
                  key={key + String(cell.inMonth)}
                  type="button"
                  className={`cal-cell${cell.inMonth ? '' : ' cal-cell-muted'}${isSelected ? ' cal-cell-selected' : ''}${isToday ? ' cal-cell-today' : ''}`}
                  onClick={() => setSelected(key)}
                >
                  <span className="cal-day">{cell.date.getDate()}</span>
                  {dayEvents.length > 0 ? (
                    <span className="cal-dots" aria-label={`${dayEvents.length} eventos`}>
                      {dayEvents.slice(0, 3).map((ev) => (
                        <span
                          key={ev.id}
                          className={`cal-dot cal-dot-${ev.kind}`}
                        />
                      ))}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </Card>

        <Card>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
            {formatShortDate(selected)}
          </h2>
          {selectedEvents.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              Sin vencimientos este día.
            </p>
          ) : (
            <div className="money-list">
              {selectedEvents.map((ev) => (
                <Link key={ev.id} to={ev.href} className="money-row money-row-link">
                  <span className={`money-dot cal-dot-${ev.kind}`} />
                  <span className="money-row-main">
                    <strong>{ev.title}</strong>
                    <span className="muted">{ev.subtitle}</span>
                  </span>
                  {ev.amount != null ? (
                    <span className="amount">{formatMoney(ev.amount, currency)}</span>
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="section-head">
            <h2 style={{ fontSize: '1rem', margin: 0 }}>Próximos 45 días</h2>
            <Link to="/planificacion" className="text-link">
              Planificación
            </Link>
          </div>
          {plan.loading ? (
            <p className="muted" style={{ marginTop: '0.75rem' }}>
              Cargando…
            </p>
          ) : upcoming.length === 0 ? (
            <div style={{ marginTop: '0.75rem' }}>
              <EmptyState
                title="Nada en el horizonte"
                description="Añade recurrentes, fechas de deuda u objetivos con deadline."
              />
            </div>
          ) : (
            <div className="money-list" style={{ marginTop: '0.5rem' }}>
              {upcoming.map((ev) => (
                <Link key={ev.id} to={ev.href} className="money-row money-row-link">
                  <span className={`money-dot cal-dot-${ev.kind}`} />
                  <span className="money-row-main">
                    <strong>{ev.title}</strong>
                    <span className="muted">
                      {formatShortDate(ev.date)} · {ev.subtitle}
                    </span>
                  </span>
                  {ev.amount != null ? (
                    <span className="amount">{formatMoney(ev.amount, currency)}</span>
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  )
}
