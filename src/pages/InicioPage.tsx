import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ProgressBar } from '@/components/plan/ProgressBar'
import { ConfigBanner } from '@/components/money/ConfigBanner'
import { TemplateChips } from '@/components/money/TemplateChips'
import { OnboardingTip } from '@/components/OnboardingTip'
import { SyncStatus } from '@/components/SyncStatus'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/contexts/AuthContext'
import { usePlanData } from '@/hooks/usePlanData'
import { dayBounds, summarizeRange, weekBounds } from '@/lib/balances'
import { formatMoney } from '@/lib/currency'
import { formatShortDate } from '@/lib/dates'
import { goalProgressRatio } from '@/lib/planning'
import {
  buildReminders,
  filterActiveReminders,
  readDismissedReminderIds,
} from '@/lib/reminders'
import { listTemplates } from '@/lib/templateApi'
import type { TransactionTemplate } from '@/types/database'

export function InicioPage() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const name = profile?.display_name || user?.email?.split('@')[0] || 'tú'
  const currency = profile?.currency ?? 'EUR'
  const money = usePlanData()
  const [templates, setTemplates] = useState<TransactionTemplate[]>([])

  const refreshTemplates = useCallback(async () => {
    if (!user?.id || !money.configured) {
      setTemplates([])
      return
    }
    try {
      setTemplates(await listTemplates(user.id))
    } catch {
      setTemplates([])
    }
  }, [user?.id, money.configured])

  useEffect(() => {
    void refreshTemplates()
  }, [refreshTemplates])

  const recent = money.transactions.slice(0, 6)
  const goalSnippets = money.activeGoals.slice(0, 2)
  const warningSnippets = money.budgetWarnings.slice(0, 2)

  const today = useMemo(() => {
    const { start, end } = dayBounds()
    return summarizeRange(money.transactions, start, end)
  }, [money.transactions])

  const week = useMemo(() => {
    const { start, end } = weekBounds()
    return summarizeRange(money.transactions, start, end)
  }, [money.transactions])

  const compactAlerts = useMemo(() => {
    const all = buildReminders({
      budgetWarnings: money.budgetWarnings,
      recurringRules: money.recurringRules,
      debts: money.debts,
      goals: money.goals,
      transactions: money.transactions,
    })
    return filterActiveReminders(all, readDismissedReminderIds()).slice(0, 3)
  }, [
    money.budgetWarnings,
    money.recurringRules,
    money.debts,
    money.goals,
    money.transactions,
  ])

  return (
    <main className="page">
      <header className="page-header page-header-row">
        <div>
          <h1>Inicio</h1>
          <p className="page-header-greeting">Hola, {name}</p>
        </div>
        <SyncStatus
          configured={money.configured}
          loading={money.loading}
          lastSyncedAt={money.lastSyncedAt}
          onRefresh={() => void money.refresh()}
        />
      </header>

      <div className="stack-md">
        <OnboardingTip />
        <ConfigBanner configured={money.configured} error={money.error} />

        <Card accent>
          <p className="label muted" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>
            Patrimonio
          </p>
          <p className="amount" style={{ fontSize: '1.75rem', margin: 0 }}>
            {formatMoney(money.totalBalance, currency)}
          </p>
          <p className="muted" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
            {money.loading
              ? 'Calculando saldos…'
              : money.activeAccounts.length === 0
                ? 'Sin cuentas activas. Crea la primera para empezar.'
                : `${money.activeAccounts.length} cuenta${money.activeAccounts.length === 1 ? '' : 's'} activa${money.activeAccounts.length === 1 ? '' : 's'}`}
          </p>
        </Card>

        <div className="home-shortcuts" aria-label="Atajos rápidos">
          <Button size="sm" onClick={() => navigate('/movimientos?nuevo=1&quick=expense')}>
            Gasto
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate('/movimientos?nuevo=1&quick=income')}
          >
            Ingreso
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate('/movimientos?transferencia=1')}
          >
            Transferir
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/objetivos')}>
            Objetivos
          </Button>
        </div>

        {templates.length > 0 ? (
          <div>
            <div className="section-head" style={{ marginBottom: '0.35rem' }}>
              <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
                Plantillas rápidas
              </p>
              <Link to="/plantillas" className="text-link" style={{ fontSize: '0.8rem' }}>
                Gestionar
              </Link>
            </div>
            <TemplateChips
              templates={templates}
              currency={currency}
              onSelect={(tpl) => navigate(`/movimientos?plantilla=${tpl.id}`)}
            />
          </div>
        ) : null}

        <div className="summary-grid">
          <Card>
            <p className="label muted" style={{ fontSize: '0.7rem', marginBottom: '0.35rem' }}>
              Hoy · ingresos
            </p>
            <p className="amount amount-income" style={{ margin: 0 }}>
              {formatMoney(today.income, currency)}
            </p>
            <p className="muted" style={{ fontSize: '0.75rem', marginTop: '0.35rem' }}>
              Gastos {formatMoney(today.expense, currency)}
            </p>
          </Card>
          <Card>
            <p className="label muted" style={{ fontSize: '0.7rem', marginBottom: '0.35rem' }}>
              Semana · balance
            </p>
            <p
              className={`amount${week.balance >= 0 ? ' amount-income' : ' amount-expense'}`}
              style={{ margin: 0 }}
            >
              {formatMoney(week.balance, currency)}
            </p>
            <p className="muted" style={{ fontSize: '0.75rem', marginTop: '0.35rem' }}>
              {formatMoney(week.income, currency)} − {formatMoney(week.expense, currency)}
            </p>
          </Card>
          <Card>
            <p className="label muted" style={{ fontSize: '0.7rem', marginBottom: '0.35rem' }}>
              Ingresos del mes
            </p>
            <p className="amount amount-income" style={{ margin: 0 }}>
              {formatMoney(money.monthSummary.income, currency)}
            </p>
          </Card>
          <Card>
            <p className="label muted" style={{ fontSize: '0.7rem', marginBottom: '0.35rem' }}>
              Gastos del mes
            </p>
            <p className="amount amount-expense" style={{ margin: 0 }}>
              {formatMoney(money.monthSummary.expense, currency)}
            </p>
          </Card>
          <Card elevated className="summary-span">
            <p className="label muted" style={{ fontSize: '0.7rem', marginBottom: '0.35rem' }}>
              Balance del mes
            </p>
            <p
              className={`amount${money.monthSummary.balance >= 0 ? ' amount-income' : ' amount-expense'}`}
              style={{ margin: 0 }}
            >
              {formatMoney(money.monthSummary.balance, currency)}
            </p>
          </Card>
        </div>

        {compactAlerts.length > 0 ? (
          <Card>
            <div className="section-head">
              <h2 style={{ fontSize: '1rem', margin: 0 }}>Avisos</h2>
              <Link to="/recordatorios" className="text-link">
                Ver todos
              </Link>
            </div>
            <div className="money-list" style={{ marginTop: '0.5rem' }}>
              {compactAlerts.map((item) => (
                <Link key={item.id} to={item.href} className="money-row money-row-link">
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
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        ) : null}

        <Card>
          <div className="section-head">
            <h2 style={{ fontSize: '1rem', margin: 0 }}>Últimos movimientos</h2>
            <Link to="/movimientos" className="text-link">
              Ver todos
            </Link>
          </div>

          {money.loading ? (
            <p className="muted" style={{ marginTop: '0.75rem' }}>
              Cargando…
            </p>
          ) : recent.length === 0 ? (
            <div style={{ marginTop: '0.75rem' }}>
              <EmptyState
                title="Todavía no hay actividad"
                description="Registra un ingreso o gasto con el botón +."
                action={
                  <Button size="sm" onClick={() => navigate('/movimientos?nuevo=1')}>
                    Registrar ahora
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="money-list" style={{ marginTop: '0.5rem' }}>
              {recent.map((tx) => {
                const account = money.accountsById.get(tx.account_id)
                const category = tx.category_id
                  ? money.categoriesById.get(tx.category_id)
                  : undefined
                const signed = tx.type === 'income' ? tx.amount : -tx.amount
                return (
                  <Link key={tx.id} to="/movimientos" className="money-row money-row-link">
                    <span
                      className="money-dot"
                      style={{ background: category?.color ?? account?.color ?? 'var(--accent)' }}
                    />
                    <span className="money-row-main">
                      <strong>{tx.concept}</strong>
                      <span className="muted">
                        {formatShortDate(tx.occurred_at)} · {account?.name ?? 'Cuenta'}
                      </span>
                    </span>
                    <span
                      className={`amount${tx.type === 'expense' ? ' amount-expense' : ' amount-income'}`}
                    >
                      {formatMoney(signed, currency)}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </Card>

        {warningSnippets.length > 0 ? (
          <Card>
            <div className="section-head">
              <h2 style={{ fontSize: '1rem', margin: 0 }}>Límites a vigilar</h2>
              <Link to="/planificacion" className="text-link">
                Ver
              </Link>
            </div>
            <div className="money-list" style={{ marginTop: '0.5rem' }}>
              {warningSnippets.map((item) => (
                <div key={item.budget.id} className="money-row money-row-stack money-row-static">
                  <span
                    className="money-dot"
                    style={{ background: item.category?.color ?? 'var(--accent)' }}
                  />
                  <span className="money-row-main">
                    <strong>{item.category?.name ?? 'Categoría'}</strong>
                    <span className="muted">
                      {item.overLimit ? 'Límite superado' : 'Cerca del límite'} ·{' '}
                      {formatMoney(item.spent, currency)} / {formatMoney(item.limit, currency)}
                    </span>
                    <ProgressBar
                      ratio={item.ratio}
                      tone={item.overLimit ? 'danger' : 'warn'}
                    />
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {goalSnippets.length > 0 ? (
          <Card>
            <div className="section-head">
              <h2 style={{ fontSize: '1rem', margin: 0 }}>Objetivos</h2>
              <Link to="/objetivos" className="text-link">
                Ver
              </Link>
            </div>
            <div className="money-list" style={{ marginTop: '0.5rem' }}>
              {goalSnippets.map((goal) => {
                const ratio = goalProgressRatio(goal)
                return (
                  <Link
                    key={goal.id}
                    to="/objetivos"
                    className="money-row money-row-stack money-row-link"
                  >
                    <span className="money-dot" style={{ background: goal.color }} />
                    <span className="money-row-main">
                      <strong>{goal.name}</strong>
                      <span className="muted">
                        {formatMoney(goal.current_amount, currency)} de{' '}
                        {formatMoney(goal.target_amount, currency)}
                      </span>
                      <ProgressBar ratio={ratio} tone="accent" />
                    </span>
                    <span className="amount">{Math.round(ratio * 100)}%</span>
                  </Link>
                )
              })}
            </div>
          </Card>
        ) : null}

        <Card>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Más accesos</h2>
          <div className="more-grid">
            <Link className="more-link" to="/calendario">
              <strong>Calendario</strong>
              <span>Vencimientos</span>
            </Link>
            <Link className="more-link" to="/informes">
              <strong>Informes</strong>
              <span>PDF y Excel</span>
            </Link>
            <Link className="more-link" to="/analisis">
              <strong>Análisis</strong>
              <span>Periodos</span>
            </Link>
            <Link className="more-link" to="/centro-financiero">
              <strong>Centro financiero</strong>
              <span>Salud</span>
            </Link>
          </div>
        </Card>
      </div>
    </main>
  )
}
