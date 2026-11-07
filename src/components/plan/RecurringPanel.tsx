import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Sheet } from '@/components/ui/Sheet'
import { formatMoney } from '@/lib/currency'
import { formatShortDate, toDateInputValue } from '@/lib/dates'
import {
  RECURRING_FREQUENCY_LABELS,
  RECURRING_FREQUENCY_OPTIONS,
  TRANSACTION_TYPE_LABELS,
} from '@/lib/labels'
import { MoneyApiError } from '@/lib/moneyApi'
import {
  createRecurringRule,
  deleteRecurringRule,
  updateRecurringRule,
} from '@/lib/planApi'
import type { RecurringOccurrence } from '@/lib/planning'
import type {
  Account,
  Category,
  RecurringFrequency,
  RecurringRule,
  TransactionType,
} from '@/types/database'

type Draft = {
  id?: string
  type: TransactionType
  amount: string
  concept: string
  account_id: string
  category_id: string
  frequency: RecurringFrequency
  next_occurrence: string
  is_active: boolean
}

const emptyDraft = (accountId = '', categoryId = ''): Draft => ({
  type: 'expense',
  amount: '',
  concept: '',
  account_id: accountId,
  category_id: categoryId,
  frequency: 'monthly',
  next_occurrence: toDateInputValue(),
  is_active: true,
})

interface RecurringPanelProps {
  currency: string
  userId: string | null
  configured: boolean
  loading: boolean
  rules: RecurringRule[]
  forecast: RecurringOccurrence[]
  forecastSummary: { income: number; expense: number; net: number; count: number }
  accounts: Account[]
  categories: Category[]
  onChanged: () => Promise<void>
}

export function RecurringPanel({
  currency,
  userId,
  configured,
  loading,
  rules,
  forecast,
  forecastSummary,
  accounts,
  categories,
  onChanged,
}: RecurringPanelProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  const visible = useMemo(
    () => rules.filter((r) => showInactive || r.is_active),
    [rules, showInactive],
  )

  const accountOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.is_active || a.id === draft.account_id)
        .map((a) => ({ value: a.id, label: a.name })),
    [accounts, draft.account_id],
  )

  const categoryOptions = useMemo(
    () =>
      categories
        .filter((c) => c.kind === draft.type && (c.is_active || c.id === draft.category_id))
        .map((c) => ({ value: c.id, label: c.name })),
    [categories, draft.type, draft.category_id],
  )

  function openCreate() {
    const accountId = accounts.find((a) => a.is_active)?.id ?? ''
    const categoryId =
      categories.find((c) => c.kind === 'expense' && c.is_active)?.id ?? ''
    setDraft(emptyDraft(accountId, categoryId))
    setFormError(null)
    setSheetOpen(true)
  }

  function openEdit(rule: RecurringRule) {
    setDraft({
      id: rule.id,
      type: rule.type,
      amount: String(rule.amount),
      concept: rule.concept,
      account_id: rule.account_id ?? '',
      category_id: rule.category_id ?? '',
      frequency: rule.frequency,
      next_occurrence: rule.next_occurrence.slice(0, 10),
      is_active: rule.is_active,
    })
    setFormError(null)
    setSheetOpen(true)
  }

  async function handleSave() {
    if (!userId) {
      setFormError('Inicia sesión para guardar recurrentes.')
      return
    }
    const concept = draft.concept.trim()
    if (!concept) {
      setFormError('El concepto es obligatorio.')
      return
    }
    const amount = Number(draft.amount.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Importe no válido.')
      return
    }
    if (!draft.account_id) {
      setFormError('Elige una cuenta.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        type: draft.type,
        amount,
        concept,
        account_id: draft.account_id,
        category_id: draft.category_id || null,
        frequency: draft.frequency,
        next_occurrence: draft.next_occurrence,
        is_active: draft.is_active,
      }
      if (draft.id) {
        await updateRecurringRule(draft.id, payload)
      } else {
        await createRecurringRule({ user_id: userId, ...payload })
      }
      setSheetOpen(false)
      await onChanged()
    } catch (err) {
      setFormError(err instanceof MoneyApiError || err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!draft.id) return
    if (!window.confirm('¿Eliminar esta regla recurrente?')) return
    setSaving(true)
    setFormError(null)
    try {
      await deleteRecurringRule(draft.id)
      setSheetOpen(false)
      await onChanged()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo eliminar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stack-md">
      <div className="section-head">
        <div>
          <h2 style={{ fontSize: '1rem', margin: 0 }}>Recurrentes</h2>
          <p className="muted" style={{ fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
            Ingresos y gastos que se repiten. Previsión a 30 días calculada en el dispositivo.
          </p>
        </div>
        <Button size="sm" onClick={openCreate} disabled={!configured || !userId}>
          Nuevo
        </Button>
      </div>

      <div className="summary-grid">
        <Card>
          <p className="label muted" style={{ fontSize: '0.7rem', marginBottom: '0.35rem' }}>
            Cobros 30 días
          </p>
          <p className="amount amount-income" style={{ margin: 0 }}>
            {formatMoney(forecastSummary.income, currency)}
          </p>
        </Card>
        <Card>
          <p className="label muted" style={{ fontSize: '0.7rem', marginBottom: '0.35rem' }}>
            Pagos 30 días
          </p>
          <p className="amount amount-expense" style={{ margin: 0 }}>
            {formatMoney(forecastSummary.expense, currency)}
          </p>
        </Card>
        <Card elevated className="summary-span">
          <p className="label muted" style={{ fontSize: '0.7rem', marginBottom: '0.35rem' }}>
            Neto previsto · {forecastSummary.count} ocurrencias
          </p>
          <p
            className={`amount${forecastSummary.net >= 0 ? ' amount-income' : ' amount-expense'}`}
            style={{ margin: 0 }}
          >
            {formatMoney(forecastSummary.net, currency)}
          </p>
        </Card>
      </div>

      <div className="chip-row">
        <button
          type="button"
          className={`chip${!showInactive ? ' chip-active' : ''}`}
          onClick={() => setShowInactive(false)}
        >
          Activos
        </button>
        <button
          type="button"
          className={`chip${showInactive ? ' chip-active' : ''}`}
          onClick={() => setShowInactive(true)}
        >
          Todos
        </button>
      </div>

      {loading ? (
        <p className="muted">Cargando recurrentes…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          title="Sin reglas recurrentes"
          description="Añade alquiler, nómina u otros pagos/cobros periódicos."
          action={
            <Button size="sm" onClick={openCreate} disabled={!configured || !userId}>
              Crear regla
            </Button>
          }
        />
      ) : (
        <div className="money-list">
          {visible.map((rule) => {
            const account = accounts.find((a) => a.id === rule.account_id)
            const category = rule.category_id
              ? categories.find((c) => c.id === rule.category_id)
              : undefined
            return (
              <button
                key={rule.id}
                type="button"
                className="money-row"
                onClick={() => openEdit(rule)}
              >
                <span
                  className="money-dot"
                  style={{ background: category?.color ?? account?.color ?? 'var(--accent)' }}
                />
                <span className="money-row-main">
                  <strong>{rule.concept}</strong>
                  <span className="muted">
                    {TRANSACTION_TYPE_LABELS[rule.type]} ·{' '}
                    {RECURRING_FREQUENCY_LABELS[rule.frequency]} · próximo{' '}
                    {formatShortDate(rule.next_occurrence)}
                    {!rule.is_active ? ' · Pausado' : ''}
                  </span>
                </span>
                <span
                  className={`amount${rule.type === 'expense' ? ' amount-expense' : ' amount-income'}`}
                >
                  {formatMoney(rule.type === 'expense' ? -rule.amount : rule.amount, currency)}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {forecast.length > 0 ? (
        <Card>
          <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.75rem' }}>Próximos 30 días</h3>
          <div className="money-list">
            {forecast.slice(0, 12).map((item) => (
              <div key={`${item.ruleId}-${item.date}`} className="money-row money-row-static">
                <span className="money-dot" style={{ background: 'var(--accent)' }} />
                <span className="money-row-main">
                  <strong>{item.concept}</strong>
                  <span className="muted">{formatShortDate(item.date)}</span>
                </span>
                <span
                  className={`amount${item.type === 'expense' ? ' amount-expense' : ' amount-income'}`}
                >
                  {formatMoney(item.type === 'expense' ? -item.amount : item.amount, currency)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Sheet
        open={sheetOpen}
        title={draft.id ? 'Editar recurrente' : 'Nuevo recurrente'}
        onClose={() => setSheetOpen(false)}
        footer={
          <div className="form-actions">
            {draft.id ? (
              <Button variant="destructive" size="sm" onClick={() => void handleDelete()} disabled={saving}>
                Eliminar
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => setSheetOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        }
      >
        <div className="money-form">
          <ErrorBanner message={formError} />
          <div className="chip-row">
            {(['expense', 'income'] as TransactionType[]).map((type) => (
              <button
                key={type}
                type="button"
                className={`chip${draft.type === type ? ' chip-active' : ''}`}
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    type,
                    category_id:
                      categories.find((c) => c.kind === type && c.is_active)?.id ?? '',
                  }))
                }
              >
                {TRANSACTION_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
          <Input
            label="Concepto"
            value={draft.concept}
            onChange={(e) => setDraft((d) => ({ ...d, concept: e.target.value }))}
          />
          <Input
            label="Importe"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={draft.amount}
            onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
          />
          <Select
            label="Cuenta"
            value={draft.account_id}
            onChange={(e) => setDraft((d) => ({ ...d, account_id: e.target.value }))}
            options={accountOptions}
            placeholder="Elige cuenta"
          />
          <Select
            label="Categoría"
            value={draft.category_id}
            onChange={(e) => setDraft((d) => ({ ...d, category_id: e.target.value }))}
            options={categoryOptions}
            placeholder="Opcional"
          />
          <Select
            label="Frecuencia"
            value={draft.frequency}
            onChange={(e) =>
              setDraft((d) => ({ ...d, frequency: e.target.value as RecurringFrequency }))
            }
            options={RECURRING_FREQUENCY_OPTIONS}
          />
          <Input
            label="Próxima fecha"
            type="date"
            value={draft.next_occurrence}
            onChange={(e) => setDraft((d) => ({ ...d, next_occurrence: e.target.value }))}
          />
          <label className="check-row">
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))}
            />
            Activo
          </label>
        </div>
      </Sheet>
    </div>
  )
}
