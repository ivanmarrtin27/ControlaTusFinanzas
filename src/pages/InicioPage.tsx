import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  IconExpense,
  IconGoals,
  IconIncome,
  IconTransfer,
} from '@/components/layout/icons'
import { ConfigBanner } from '@/components/money/ConfigBanner'
import { TemplateChips } from '@/components/money/TemplateChips'
import { OnboardingWizard } from '@/components/OnboardingWizard'
import { SyncStatus } from '@/components/SyncStatus'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { MoneyListSkeleton, Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { usePlanData } from '@/hooks/usePlanData'
import { dayBounds, summarizeRange, weekBounds } from '@/lib/balances'
import { formatMoney } from '@/lib/currency'
import { formatShortDate } from '@/lib/dates'
import {
  buildMoneyDelta,
  deltaToneClass,
  deltaVerb,
  formatDeltaArrow,
} from '@/lib/delta'
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

  const recent = money.transactions.slice(0, 5)

  const today = useMemo(() => {
    const { start, end } = dayBounds()
    return summarizeRange(money.transactions, start, end)
  }, [money.transactions])

  const week = useMemo(() => {
    const { start, end } = weekBounds()
    return summarizeRange(money.transactions, start, end)
  }, [money.transactions])

  const todayDelta = useMemo(() => buildMoneyDelta(today.balance, 0), [today.balance])
  const weekDelta = useMemo(() => buildMoneyDelta(week.balance, 0), [week.balance])
  const monthDelta = useMemo(
    () => buildMoneyDelta(money.monthSummary.balance, 0),
    [money.monthSummary.balance],
  )

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

  const accountsLabel = money.loading
    ? 'Calculando…'
    : money.activeAccounts.length === 0
      ? 'Sin cuentas activas'
      : `${money.activeAccounts.length} cuenta${money.activeAccounts.length === 1 ? '' : 's'}`

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
        <OnboardingWizard
          userId={user?.id ?? null}
          configured={money.configured}
          loading={money.loading}
          accounts={money.accounts}
          categories={money.categories}
          tags={money.tags}
          refresh={money.refresh}
        />
        <ConfigBanner configured={money.configured} error={money.error} />

        {/* 1 · Patrimonio */}
        <section className="home-hero" aria-label="Patrimonio">
          <p className="home-hero-label">Patrimonio</p>
          {money.loading ? (
            <Skeleton className="skeleton-line-hero" label="Cargando patrimonio" />
          ) : (
            <p className="home-hero-amount amount">{formatMoney(money.totalBalance, currency)}</p>
          )}
          <p className="home-hero-meta muted">
            {accountsLabel}
            {!money.loading && money.activeAccounts.length > 0 ? (
              <>
                {' · '}
                <Link to="/cuentas" className="text-link">
                  Ver cuentas
                </Link>
              </>
            ) : null}
          </p>
        </section>

        {/* 2 · Atajos */}
        <section className="home-actions" aria-label="Atajos">
          <div className="home-shortcuts">
            <button
              type="button"
              className="home-shortcut home-shortcut-expense"
              onClick={() => navigate('/movimientos?nuevo=1&quick=expense')}
            >
              <IconExpense aria-hidden />
              <span className="home-shortcut-label">Gasto</span>
            </button>
            <button
              type="button"
              className="home-shortcut home-shortcut-primary"
              onClick={() => navigate('/movimientos?nuevo=1&quick=income')}
            >
              <IconIncome aria-hidden />
              <span className="home-shortcut-label">Ingreso</span>
            </button>
            <button
              type="button"
              className="home-shortcut"
              onClick={() => navigate('/movimientos?transferencia=1')}
            >
              <IconTransfer aria-hidden />
              <span className="home-shortcut-label">Transferir</span>
            </button>
            <button
              type="button"
              className="home-shortcut"
              onClick={() => navigate('/objetivos')}
            >
              <IconGoals aria-hidden />
              <span className="home-shortcut-label">Objetivos</span>
            </button>
          </div>

          {templates.length > 0 ? (
            <div className="home-templates">
              <div className="section-head home-templates-head">
                <span className="muted home-templates-label">Plantillas</span>
                <Link to="/plantillas" className="text-link">
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
        </section>

        {/* 3 · Resumen periodo */}
        <section className="home-period" aria-label="Resumen del periodo">
          <div className="home-period-cell">
            <p className="home-period-label">Hoy</p>
            <p
              className={`home-period-value amount${today.balance >= 0 ? ' amount-income' : ' amount-expense'}`}
            >
              {formatMoney(today.balance, currency)}
            </p>
            <p className={`home-period-sub ${deltaToneClass(todayDelta.direction)}`}>
              {formatDeltaArrow(todayDelta.direction)} {deltaVerb(todayDelta.direction)}
            </p>
            <p className="home-period-sub muted">
              {formatMoney(today.income, currency)} − {formatMoney(today.expense, currency)}
            </p>
          </div>
          <div className="home-period-cell">
            <p className="home-period-label">Semana</p>
            <p
              className={`home-period-value amount${week.balance >= 0 ? ' amount-income' : ' amount-expense'}`}
            >
              {formatMoney(week.balance, currency)}
            </p>
            <p className={`home-period-sub ${deltaToneClass(weekDelta.direction)}`}>
              {formatDeltaArrow(weekDelta.direction)} {deltaVerb(weekDelta.direction)}
            </p>
          </div>
          <div className="home-period-cell">
            <p className="home-period-label">Mes</p>
            <p
              className={`home-period-value amount${money.monthSummary.balance >= 0 ? ' amount-income' : ' amount-expense'}`}
            >
              {formatMoney(money.monthSummary.balance, currency)}
            </p>
            <p className={`home-period-sub ${deltaToneClass(monthDelta.direction)}`}>
              {formatDeltaArrow(monthDelta.direction)} {deltaVerb(monthDelta.direction)}
            </p>
            <p className="home-period-sub muted">
              {formatMoney(money.monthSummary.income, currency)} −{' '}
              {formatMoney(money.monthSummary.expense, currency)}
            </p>
          </div>
        </section>

        {/* 4 · Avisos */}
        {compactAlerts.length > 0 ? (
          <Card className="home-alerts">
            <div className="section-head">
              <h2>Avisos</h2>
              <Link to="/recordatorios" className="text-link">
                Ver todos
              </Link>
            </div>
            <div className="money-list home-alerts-list">
              {compactAlerts.map((item) => (
                <Link key={item.id} to={item.href} className="money-row money-row-link home-alert-row">
                  <span
                    className="money-dot"
                    style={{
                      background:
                        item.severity === 'danger'
                          ? 'var(--danger)'
                          : item.severity === 'warn'
                            ? 'var(--warning)'
                            : 'var(--accent)',
                    }}
                  />
                  <span className="money-row-main">
                    <strong>{item.title}</strong>
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        ) : null}

        {/* 5 · Recientes */}
        <Card>
          <div className="section-head">
            <h2>Recientes</h2>
            <Link to="/movimientos" className="text-link">
              Ver todos
            </Link>
          </div>

          {money.loading ? (
            <div style={{ marginTop: '0.35rem' }}>
              <MoneyListSkeleton rows={4} />
            </div>
          ) : recent.length === 0 ? (
            <div style={{ marginTop: '0.5rem' }}>
              <EmptyState
                title="Sin movimientos"
                description="Registra un gasto o ingreso para verlos aquí."
                action={
                  money.activeAccounts.length === 0 ? (
                    <Button size="sm" onClick={() => navigate('/cuentas')}>
                      Crear cuenta
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => navigate('/movimientos?nuevo=1')}>
                      Añadir movimiento
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <div className="money-list" style={{ marginTop: '0.35rem' }}>
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
      </div>
    </main>
  )
}
