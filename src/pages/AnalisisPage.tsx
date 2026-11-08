import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ConfigBanner } from '@/components/money/ConfigBanner'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'
import { useMoneyData } from '@/hooks/useMoneyData'
import {
  comparativeInsight,
  expenseByCategory,
  formatPercent,
  formatSignedPercent,
  previousEqualRange,
  relativeChange,
  resolvePeriodRange,
  summarizePeriod,
  type PeriodPreset,
} from '@/lib/analysis'
import { formatMoney } from '@/lib/currency'
import { toDateInputValue } from '@/lib/dates'

const PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: 'this_month', label: 'Este mes' },
  { id: 'last_month', label: 'Mes pasado' },
  { id: 'custom', label: 'Personalizado' },
]

function defaultCustomFrom(): string {
  const d = new Date()
  d.setDate(1)
  return toDateInputValue(d)
}

export function AnalisisPage() {
  const { profile } = useAuth()
  const currency = profile?.currency ?? 'EUR'
  const money = useMoneyData()

  const [preset, setPreset] = useState<PeriodPreset>('this_month')
  const [customFrom, setCustomFrom] = useState(defaultCustomFrom)
  const [customTo, setCustomTo] = useState(() => toDateInputValue())

  const range = useMemo(
    () => resolvePeriodRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  )
  const priorRange = useMemo(() => previousEqualRange(range), [range])

  const current = useMemo(
    () => summarizePeriod(money.transactions, range),
    [money.transactions, range],
  )
  const previous = useMemo(
    () => summarizePeriod(money.transactions, priorRange),
    [money.transactions, priorRange],
  )
  const categories = useMemo(
    () => expenseByCategory(money.transactions, money.categoriesById, range),
    [money.transactions, money.categoriesById, range],
  )
  const insight = useMemo(() => comparativeInsight(current, previous), [current, previous])
  const expenseChange = relativeChange(current.expense, previous.expense)
  const incomeChange = relativeChange(current.income, previous.income)

  const totalExpenseShare = current.expense

  return (
    <main className="page">
      <header className="page-header page-header-row">
        <div>
          <h1>Análisis</h1>
          <p>Compara periodos, ingresos frente a gastos y desglose por categoría.</p>
        </div>
        <Link to="/informes" className="text-link">
          Exportar informe
        </Link>
      </header>

      <div className="stack-md">
        <ConfigBanner configured={money.configured} error={money.error} />

        <Card>
          <p className="label muted" style={{ fontSize: '0.75rem', marginBottom: '0.65rem' }}>
            Periodo
          </p>
          <div className="chip-row" role="tablist" aria-label="Selector de periodo">
            {PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`chip${preset === item.id ? ' chip-active' : ''}`}
                onClick={() => {
                  setPreset(item.id)
                  window.scrollTo(0, 0)
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          {preset === 'custom' ? (
            <div className="filters-grid" style={{ marginTop: '0.85rem' }}>
              <Input
                label="Desde"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <Input
                label="Hasta"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          ) : null}
        </Card>

        <div key={preset} className="subsection-enter stack-md">
        <div className="summary-grid">
          <Card>
            <p className="label muted" style={{ fontSize: '0.7rem', marginBottom: '0.35rem' }}>
              Ingresos
            </p>
            <p className="amount amount-income" style={{ margin: 0 }}>
              {formatMoney(current.income, currency)}
            </p>
            {previous.count > 0 ? (
              <p className="muted" style={{ fontSize: '0.75rem', marginTop: '0.35rem' }}>
                vs ant. {formatSignedPercent(incomeChange)}
              </p>
            ) : null}
          </Card>
          <Card>
            <p className="label muted" style={{ fontSize: '0.7rem', marginBottom: '0.35rem' }}>
              Gastos
            </p>
            <p className="amount amount-expense" style={{ margin: 0 }}>
              {formatMoney(current.expense, currency)}
            </p>
            {previous.count > 0 ? (
              <p className="muted" style={{ fontSize: '0.75rem', marginTop: '0.35rem' }}>
                vs ant. {formatSignedPercent(expenseChange)}
              </p>
            ) : null}
          </Card>
          <Card elevated className="summary-span">
            <p className="label muted" style={{ fontSize: '0.7rem', marginBottom: '0.35rem' }}>
              Balance del periodo
            </p>
            <p
              className={`amount${current.balance >= 0 ? ' amount-income' : ' amount-expense'}`}
              style={{ margin: 0 }}
            >
              {formatMoney(current.balance, currency)}
            </p>
            <div className="vs-bar" aria-hidden="true">
              <span
                className="vs-bar-income"
                style={{
                  flexGrow: Math.max(current.income, 0.01),
                }}
              />
              <span
                className="vs-bar-expense"
                style={{
                  flexGrow: Math.max(current.expense, 0.01),
                }}
              />
            </div>
            <p className="muted" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
              {current.count === 0
                ? 'Sin movimientos en este periodo.'
                : `${current.count} movimiento${current.count === 1 ? '' : 's'}`}
            </p>
          </Card>
        </div>

        <Card>
          <h2 style={{ fontSize: '1rem', margin: 0 }}>Comparativa</h2>
          <p style={{ marginTop: '0.65rem', fontSize: '0.9rem', lineHeight: 1.45 }}>
            {insight.text}
          </p>
          {previous.count > 0 ? (
            <div className="summary-grid" style={{ marginTop: '0.85rem' }}>
              <div>
                <p className="label muted" style={{ fontSize: '0.7rem', marginBottom: '0.25rem' }}>
                  Balance anterior
                </p>
                <p
                  className={`amount${previous.balance >= 0 ? ' amount-income' : ' amount-expense'}`}
                  style={{ margin: 0, fontSize: '0.95rem' }}
                >
                  {formatMoney(previous.balance, currency)}
                </p>
              </div>
              <div>
                <p className="label muted" style={{ fontSize: '0.7rem', marginBottom: '0.25rem' }}>
                  Δ balance
                </p>
                <p
                  className={`amount${insight.balanceDelta >= 0 ? ' amount-income' : ' amount-expense'}`}
                  style={{ margin: 0, fontSize: '0.95rem' }}
                >
                  {formatMoney(insight.balanceDelta, currency)}
                </p>
              </div>
            </div>
          ) : null}
        </Card>

        <Card>
          <div className="section-head">
            <h2 style={{ fontSize: '1rem', margin: 0 }}>Gastos por categoría</h2>
            <Link to="/categorias" className="text-link">
              Categorías
            </Link>
          </div>

          {money.loading ? (
            <p className="muted" style={{ marginTop: '0.75rem' }}>
              Cargando…
            </p>
          ) : categories.length === 0 ? (
            <div style={{ marginTop: '0.75rem' }}>
              <EmptyState
                title="Sin gastos en el periodo"
                description="Cuando registres gastos, verás el desglose aquí."
              />
            </div>
          ) : (
            <div className="cat-bars" style={{ marginTop: '0.85rem' }}>
              {categories.map((row) => {
                const share =
                  totalExpenseShare > 0 ? row.amount / totalExpenseShare : 0
                return (
                  <div key={row.categoryId ?? 'none'} className="cat-bar-row">
                    <div className="cat-bar-meta">
                      <span className="money-dot" style={{ background: row.color }} />
                      <strong>{row.name}</strong>
                      <span className="amount">{formatMoney(row.amount, currency)}</span>
                    </div>
                    <div className="cat-bar-track" aria-hidden="true">
                      <div
                        className="cat-bar-fill"
                        style={{
                          width: `${Math.max(4, Math.round(row.ratio * 100))}%`,
                          background: row.color,
                        }}
                      />
                    </div>
                    <p className="muted cat-bar-share">{formatPercent(share)} del gasto</p>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card>
          <div className="section-head">
            <h2 style={{ fontSize: '1rem', margin: 0 }}>Patrimonio</h2>
            <Link to="/cuentas" className="text-link">
              Cuentas
            </Link>
          </div>
          <p className="amount" style={{ fontSize: '1.35rem', margin: '0.65rem 0 0' }}>
            {formatMoney(money.totalBalance, currency)}
          </p>
          <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
            {money.activeAccounts.length === 0
              ? 'Sin cuentas activas.'
              : `Suma de ${money.activeAccounts.length} cuenta${money.activeAccounts.length === 1 ? '' : 's'} activa${money.activeAccounts.length === 1 ? '' : 's'}.`}
          </p>
          {money.activeAccounts.length > 0 ? (
            <div className="money-list" style={{ marginTop: '0.75rem' }}>
              {money.activeAccounts.map((account) => {
                const balance = money.balancesByAccount.get(account.id) ?? 0
                return (
                  <div key={account.id} className="money-row money-row-static">
                    <span className="money-dot" style={{ background: account.color }} />
                    <span className="money-row-main">
                      <strong>{account.name}</strong>
                    </span>
                    <span className="amount">{formatMoney(balance, currency)}</span>
                  </div>
                )
              })}
            </div>
          ) : null}
        </Card>
        </div>
      </div>
    </main>
  )
}
