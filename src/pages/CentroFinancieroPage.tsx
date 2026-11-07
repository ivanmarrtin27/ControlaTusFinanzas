import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ProgressBar } from '@/components/plan/ProgressBar'
import { ConfigBanner } from '@/components/money/ConfigBanner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'
import { usePlanData } from '@/hooks/usePlanData'
import {
  averageMonthlyExpense,
  buildCashflowForecast,
  EMERGENCY_MONTHS_STRETCH,
  EMERGENCY_MONTHS_TARGET,
  emergencyCushionMonths,
  formatMonths,
  formatPercent,
  formatSignedPercent,
  lastMonthRange,
  relativeChange,
  resolveEmergencyTarget,
  SAVINGS_RATE_TARGET,
  savingsRate,
  summarizeCashflow,
  summarizePeriod,
  thisMonthRange,
} from '@/lib/analysis'
import { formatMoney } from '@/lib/currency'
import { formatShortDate } from '@/lib/dates'
import { toNumber } from '@/lib/balances'
import { supabase } from '@/lib/supabase'

const LOCAL_EMERGENCY_KEY = 'ctf_emergency_fund_target'

function readLocalEmergencyTarget(): number | null {
  try {
    const raw = localStorage.getItem(LOCAL_EMERGENCY_KEY)
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

function writeLocalEmergencyTarget(value: number | null) {
  try {
    if (value == null || value <= 0) localStorage.removeItem(LOCAL_EMERGENCY_KEY)
    else localStorage.setItem(LOCAL_EMERGENCY_KEY, String(value))
  } catch {
    /* ignore */
  }
}

export function CentroFinancieroPage() {
  const navigate = useNavigate()
  const { profile, user, configured, refreshProfile } = useAuth()
  const currency = profile?.currency ?? 'EUR'
  const plan = usePlanData()

  const profileTarget = profile?.emergency_fund_target ?? null
  const [localTarget, setLocalTarget] = useState<number | null>(() => readLocalEmergencyTarget())
  const [draftTarget, setDraftTarget] = useState(() => {
    const existing = profile?.emergency_fund_target ?? readLocalEmergencyTarget()
    return existing && existing > 0 ? String(existing) : ''
  })
  const [savingTarget, setSavingTarget] = useState(false)
  const [targetMessage, setTargetMessage] = useState<string | null>(null)

  const effectiveProfileTarget =
    profileTarget != null && toNumber(profileTarget) > 0
      ? toNumber(profileTarget)
      : localTarget

  const monthRange = useMemo(() => thisMonthRange(), [])
  const priorRange = useMemo(() => lastMonthRange(), [])

  const month = useMemo(
    () => summarizePeriod(plan.transactions, monthRange),
    [plan.transactions, monthRange],
  )
  const priorMonth = useMemo(
    () => summarizePeriod(plan.transactions, priorRange),
    [plan.transactions, priorRange],
  )

  const rate = savingsRate(month.income, month.expense)
  const avgExpense = useMemo(
    () => averageMonthlyExpense(plan.transactions, 3),
    [plan.transactions],
  )
  const cushionMonths = emergencyCushionMonths(plan.totalBalance, avgExpense)
  const expenseChange = relativeChange(month.expense, priorMonth.expense)

  const emergencyTarget = resolveEmergencyTarget(effectiveProfileTarget, avgExpense)
  const emergencyProgress =
    emergencyTarget > 0 ? Math.min(1.5, plan.totalBalance / emergencyTarget) : 0
  const suggestedFromAvg = avgExpense > 0 ? avgExpense * EMERGENCY_MONTHS_TARGET : 0

  const cashflow = useMemo(
    () => buildCashflowForecast(plan.activeRecurring, plan.transactions, 30),
    [plan.activeRecurring, plan.transactions],
  )
  const cashflowSummary = useMemo(() => summarizeCashflow(cashflow), [cashflow])

  async function handleSaveTarget() {
    const parsed = draftTarget.trim() === '' ? null : Number(draftTarget.replace(',', '.'))
    if (parsed != null && (!Number.isFinite(parsed) || parsed < 0)) {
      setTargetMessage('Introduce un importe válido o déjalo vacío para usar la sugerencia.')
      return
    }

    setSavingTarget(true)
    setTargetMessage(null)

    const value = parsed != null && parsed > 0 ? Math.round(parsed * 100) / 100 : null
    writeLocalEmergencyTarget(value)
    setLocalTarget(value)

    if (!configured || !user) {
      setTargetMessage(
        value
          ? 'Objetivo guardado en este dispositivo.'
          : 'Usarás la sugerencia automática (3× gasto medio).',
      )
      setSavingTarget(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ emergency_fund_target: value })
      .eq('id', user.id)

    if (error) {
      setTargetMessage(
        `Guardado local OK. Sync Supabase: ${error.message}. ¿Aplicaste la migración?`,
      )
    } else {
      await refreshProfile()
      setTargetMessage(value ? 'Objetivo de emergencia guardado.' : 'Objetivo limpio; se usa la sugerencia.')
    }
    setSavingTarget(false)
  }

  const indicatorTone = {
    savings:
      rate == null ? 'muted' : rate >= SAVINGS_RATE_TARGET ? 'good' : rate >= 0 ? 'ok' : 'bad',
    cushion:
      cushionMonths == null
        ? 'muted'
        : cushionMonths >= EMERGENCY_MONTHS_STRETCH
          ? 'good'
          : cushionMonths >= EMERGENCY_MONTHS_TARGET
            ? 'ok'
            : 'bad',
    expense:
      expenseChange == null
        ? 'muted'
        : expenseChange <= 0
          ? 'good'
          : expenseChange <= 0.1
            ? 'ok'
            : 'bad',
    balance: month.balance >= 0 ? 'good' : 'bad',
  } as const

  return (
    <main className="page">
      <header className="page-header">
        <h1>Centro financiero</h1>
        <p>Salud del mes, colchón de emergencia y previsión a 30 días.</p>
      </header>

      <div className="stack-md">
        <ConfigBanner configured={plan.configured} error={plan.error} />

        <div className="indicator-grid">
          <Card className={`indicator-card indicator-${indicatorTone.savings}`}>
            <p className="label muted" style={{ fontSize: '0.7rem', marginBottom: '0.35rem' }}>
              Tasa de ahorro
            </p>
            <p className="amount" style={{ margin: 0, fontSize: '1.35rem' }}>
              {formatPercent(rate)}
            </p>
            <p className="muted" style={{ fontSize: '0.75rem', marginTop: '0.4rem' }}>
              Objetivo sugerido {formatPercent(SAVINGS_RATE_TARGET)} · (ingresos − gastos) /
              ingresos
            </p>
          </Card>

          <Card className={`indicator-card indicator-${indicatorTone.cushion}`}>
            <p className="label muted" style={{ fontSize: '0.7rem', marginBottom: '0.35rem' }}>
              Colchón actual
            </p>
            <p className="amount" style={{ margin: 0, fontSize: '1.35rem' }}>
              {formatMonths(cushionMonths)}
            </p>
            <p className="muted" style={{ fontSize: '0.75rem', marginTop: '0.4rem' }}>
              Patrimonio / media de gasto (3 meses). Meta {EMERGENCY_MONTHS_TARGET}–
              {EMERGENCY_MONTHS_STRETCH} meses.
            </p>
          </Card>

          <Card className={`indicator-card indicator-${indicatorTone.expense}`}>
            <p className="label muted" style={{ fontSize: '0.7rem', marginBottom: '0.35rem' }}>
              Cambio de gastos
            </p>
            <p className="amount" style={{ margin: 0, fontSize: '1.35rem' }}>
              {formatSignedPercent(expenseChange)}
            </p>
            <p className="muted" style={{ fontSize: '0.75rem', marginTop: '0.4rem' }}>
              Mes actual {formatMoney(month.expense, currency)} vs anterior{' '}
              {formatMoney(priorMonth.expense, currency)}
            </p>
          </Card>

          <Card className={`indicator-card indicator-${indicatorTone.balance}`}>
            <p className="label muted" style={{ fontSize: '0.7rem', marginBottom: '0.35rem' }}>
              Balance del mes
            </p>
            <p
              className={`amount${month.balance >= 0 ? ' amount-income' : ' amount-expense'}`}
              style={{ margin: 0, fontSize: '1.35rem' }}
            >
              {formatMoney(month.balance, currency)}
            </p>
            <p className="muted" style={{ fontSize: '0.75rem', marginTop: '0.4rem' }}>
              {formatMoney(month.income, currency)} − {formatMoney(month.expense, currency)}
            </p>
          </Card>
        </div>

        <Card accent>
          <div className="section-head">
            <h2 style={{ fontSize: '1rem', margin: 0 }}>Fondo de emergencia</h2>
            <Link to="/objetivos" className="text-link">
              Objetivos
            </Link>
          </div>
          <p className="amount" style={{ fontSize: '1.25rem', margin: '0.65rem 0 0' }}>
            {formatMoney(plan.totalBalance, currency)}
            <span className="muted" style={{ fontSize: '0.85rem', fontWeight: 400 }}>
              {' '}
              / {formatMoney(emergencyTarget, currency)}
            </span>
          </p>
          <ProgressBar
            ratio={emergencyProgress}
            tone={emergencyProgress >= 1 ? 'success' : emergencyProgress >= 0.66 ? 'accent' : 'warn'}
            label={`${Math.round(Math.min(100, emergencyProgress * 100))} % del objetivo`}
          />
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            {effectiveProfileTarget && effectiveProfileTarget > 0
              ? 'Usando tu objetivo personalizado.'
              : avgExpense > 0
                ? `Sugerencia automática: ${EMERGENCY_MONTHS_TARGET}× gasto medio (${formatMoney(suggestedFromAvg, currency)}).`
                : 'Cuando tengas gastos históricos, sugeriremos un objetivo (3× media mensual).'}
          </p>

          <div className="emergency-form" style={{ marginTop: '1rem' }}>
            <Input
              label="Objetivo personalizado"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder={
                suggestedFromAvg > 0
                  ? `Ej. ${suggestedFromAvg.toFixed(0)}`
                  : 'Importe objetivo'
              }
              value={draftTarget}
              onChange={(e) => setDraftTarget(e.target.value)}
              hint="Déjalo vacío para volver a la sugerencia automática."
            />
            <div className="header-actions" style={{ marginTop: '0.75rem' }}>
              <Button size="sm" onClick={() => void handleSaveTarget()} disabled={savingTarget}>
                {savingTarget ? 'Guardando…' : 'Guardar objetivo'}
              </Button>
              {suggestedFromAvg > 0 ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setDraftTarget(String(Math.round(suggestedFromAvg)))}
                >
                  Usar sugerencia
                </Button>
              ) : null}
            </div>
            {targetMessage ? (
              <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                {targetMessage}
              </p>
            ) : null}
          </div>
        </Card>

        <Card>
          <div className="section-head">
            <h2 style={{ fontSize: '1rem', margin: 0 }}>Previsión 30 días</h2>
            <Link to="/planificacion" className="text-link">
              Recurrentes
            </Link>
          </div>
          <div className="summary-grid" style={{ marginTop: '0.75rem' }}>
            <div>
              <p className="label muted" style={{ fontSize: '0.7rem', marginBottom: '0.25rem' }}>
                Cobros previstos
              </p>
              <p className="amount amount-income" style={{ margin: 0, fontSize: '1rem' }}>
                {formatMoney(cashflowSummary.income, currency)}
              </p>
            </div>
            <div>
              <p className="label muted" style={{ fontSize: '0.7rem', marginBottom: '0.25rem' }}>
                Pagos previstos
              </p>
              <p className="amount amount-expense" style={{ margin: 0, fontSize: '1rem' }}>
                {formatMoney(cashflowSummary.expense, currency)}
              </p>
            </div>
            <div className="summary-span">
              <p className="label muted" style={{ fontSize: '0.7rem', marginBottom: '0.25rem' }}>
                Neto previsto
              </p>
              <p
                className={`amount${cashflowSummary.net >= 0 ? ' amount-income' : ' amount-expense'}`}
                style={{ margin: 0, fontSize: '1.05rem' }}
              >
                {formatMoney(cashflowSummary.net, currency)}
              </p>
            </div>
          </div>
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.65rem' }}>
            Combina reglas recurrentes activas y movimientos con fecha futura (sin duplicar si
            ya están vinculados a una regla).
          </p>

          {plan.loading ? (
            <p className="muted" style={{ marginTop: '0.75rem' }}>
              Cargando…
            </p>
          ) : cashflow.length === 0 ? (
            <div style={{ marginTop: '0.75rem' }}>
              <EmptyState
                title="Sin cobros ni pagos previstos"
                description="Crea reglas en Planificación → Recurrentes o registra movimientos futuros."
                action={
                  <Button size="sm" variant="secondary" onClick={() => navigate('/planificacion')}>
                    Ir a planificación
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="money-list" style={{ marginTop: '0.75rem' }}>
              {cashflow.slice(0, 12).map((item) => {
                const signed = item.type === 'income' ? item.amount : -item.amount
                return (
                  <div key={item.id} className="money-row money-row-static">
                    <span
                      className="money-dot"
                      style={{
                        background: item.type === 'income' ? 'var(--success)' : '#f87171',
                      }}
                    />
                    <span className="money-row-main">
                      <strong>{item.concept}</strong>
                      <span className="muted">
                        {formatShortDate(item.date)} ·{' '}
                        {item.source === 'recurring' ? 'Recurrente' : 'Programado'}
                      </span>
                    </span>
                    <span
                      className={`amount${item.type === 'expense' ? ' amount-expense' : ' amount-income'}`}
                    >
                      {formatMoney(signed, currency)}
                    </span>
                  </div>
                )
              })}
              {cashflow.length > 12 ? (
                <p className="muted" style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}>
                  +{cashflow.length - 12} más en los próximos 30 días
                </p>
              ) : null}
            </div>
          )}
        </Card>
      </div>
    </main>
  )
}
