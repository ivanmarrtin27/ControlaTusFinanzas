import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BudgetsPanel } from '@/components/plan/BudgetsPanel'
import { DebtsPanel } from '@/components/plan/DebtsPanel'
import { RecurringPanel } from '@/components/plan/RecurringPanel'
import { ConfigBanner } from '@/components/money/ConfigBanner'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'
import { usePlanData } from '@/hooks/usePlanData'

type Tab = 'limites' | 'recurrentes' | 'deudas'

const TABS: { id: Tab; label: string }[] = [
  { id: 'limites', label: 'Límites' },
  { id: 'recurrentes', label: 'Recurrentes' },
  { id: 'deudas', label: 'Deudas' },
]

function parseTab(value: string | null): Tab {
  if (value === 'recurrentes' || value === 'deudas' || value === 'limites') return value
  return 'limites'
}

export function PlanificacionPage() {
  const { profile } = useAuth()
  const currency = profile?.currency ?? 'EUR'
  const plan = usePlanData()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(() => parseTab(searchParams.get('tab')))

  useEffect(() => {
    setTab(parseTab(searchParams.get('tab')))
  }, [searchParams])

  const periodLabel = useMemo(() => {
    try {
      const parts = plan.currentPeriod.split('-').map(Number)
      const y = parts[0] ?? new Date().getFullYear()
      const m = parts[1] ?? 1
      return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(
        new Date(y, m - 1, 1),
      )
    } catch {
      return plan.currentPeriod
    }
  }, [plan.currentPeriod])

  const expenseCategories = useMemo(
    () => plan.categories.filter((c) => c.kind === 'expense'),
    [plan.categories],
  )

  function selectTab(next: Tab) {
    setTab(next)
    setSearchParams(next === 'limites' ? {} : { tab: next }, { replace: true })
    window.scrollTo(0, 0)
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>Planificación</h1>
        <p>Límites de gasto, reglas recurrentes y deudas. Los objetivos de ahorro están en su propia sección.</p>
      </header>

      <div className="stack-md">
        <ConfigBanner configured={plan.configured} error={plan.error} />

        <Card>
          <div className="section-head">
            <div>
              <strong>Objetivos de ahorro</strong>
              <p className="muted" style={{ fontSize: '0.8rem', margin: '0.2rem 0 0' }}>
                {plan.activeGoals.length === 0
                  ? 'Todavía no tienes metas activas.'
                  : `${plan.activeGoals.length} objetivo${plan.activeGoals.length === 1 ? '' : 's'} activo${plan.activeGoals.length === 1 ? '' : 's'}.`}
              </p>
            </div>
            <Link to="/objetivos" className="text-link">
              Abrir
            </Link>
          </div>
        </Card>

        <div className="chip-row" role="tablist" aria-label="Secciones de planificación">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`chip${tab === item.id ? ' chip-active' : ''}`}
              onClick={() => selectTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div key={tab} className="subsection-enter" role="tabpanel">
          {tab === 'limites' ? (
            <BudgetsPanel
              currency={currency}
              userId={plan.userId}
              configured={plan.configured}
              loading={plan.loading}
              periodLabel={periodLabel}
              periodMonth={plan.currentPeriod}
              progress={plan.budgetProgress}
              expenseCategories={expenseCategories}
              onChanged={plan.refresh}
            />
          ) : null}

          {tab === 'recurrentes' ? (
            <RecurringPanel
              currency={currency}
              userId={plan.userId}
              configured={plan.configured}
              loading={plan.loading}
              rules={plan.recurringRules}
              forecast={plan.forecast30}
              forecastSummary={plan.forecastSummary}
              accounts={plan.accounts}
              categories={plan.categories}
              onChanged={plan.refresh}
            />
          ) : null}

          {tab === 'deudas' ? (
            <DebtsPanel
              currency={currency}
              userId={plan.userId}
              configured={plan.configured}
              loading={plan.loading}
              debts={plan.debts}
              accounts={plan.activeAccounts}
              onChanged={plan.refresh}
            />
          ) : null}
        </div>
      </div>
    </main>
  )
}
