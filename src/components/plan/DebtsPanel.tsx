import { useMemo, useState } from 'react'
import { ProgressBar } from '@/components/plan/ProgressBar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Sheet } from '@/components/ui/Sheet'
import { MoneyListSkeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/contexts/ToastContext'
import { formatMoney } from '@/lib/currency'
import { toDateInputValue } from '@/lib/dates'
import { DEBT_DIRECTION_LABELS, DEBT_STATUS_LABELS } from '@/lib/labels'
import { MoneyApiError } from '@/lib/moneyApi'
import {
  createDebt,
  deleteDebt,
  recordDebtPayment,
  updateDebt,
} from '@/lib/planApi'
import type { Account, Debt, DebtDirection } from '@/types/database'

type Mode = 'edit' | 'pay'

type Draft = {
  id?: string
  direction: DebtDirection
  person_name: string
  principal: string
  remaining: string
  status: Debt['status']
  due_date: string
}

type PayDraft = {
  debtId: string
  amount: string
  occurred_at: string
  account_id: string
  createTransaction: boolean
}

const emptyDraft = (): Draft => ({
  direction: 'owe',
  person_name: '',
  principal: '',
  remaining: '',
  status: 'pending',
  due_date: '',
})

interface DebtsPanelProps {
  currency: string
  userId: string | null
  configured: boolean
  loading: boolean
  debts: Debt[]
  accounts: Account[]
  onChanged: () => Promise<void>
}

export function DebtsPanel({
  currency,
  userId,
  configured,
  loading,
  debts,
  accounts,
  onChanged,
}: DebtsPanelProps) {
  const toast = useToast()
  const [directionTab, setDirectionTab] = useState<DebtDirection | 'all'>('all')
  const [showSettled, setShowSettled] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('edit')
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [payDraft, setPayDraft] = useState<PayDraft | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return debts.filter((d) => {
      if (directionTab !== 'all' && d.direction !== directionTab) return false
      if (!showSettled && d.status === 'settled') return false
      if (q && !d.person_name.toLowerCase().includes(q)) return false
      return true
    })
  }, [debts, directionTab, showSettled, query])

  const accountOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.is_active)
        .map((a) => ({ value: a.id, label: a.name })),
    [accounts],
  )

  function openCreate() {
    setMode('edit')
    setDraft(emptyDraft())
    setPayDraft(null)
    setFormError(null)
    setSheetOpen(true)
  }

  function openEdit(debt: Debt) {
    setMode('edit')
    setDraft({
      id: debt.id,
      direction: debt.direction,
      person_name: debt.person_name,
      principal: String(debt.principal),
      remaining: String(debt.remaining),
      status: debt.status,
      due_date: debt.due_date ?? '',
    })
    setPayDraft(null)
    setFormError(null)
    setSheetOpen(true)
  }

  function openPay(debt: Debt) {
    setMode('pay')
    setDraft({
      id: debt.id,
      direction: debt.direction,
      person_name: debt.person_name,
      principal: String(debt.principal),
      remaining: String(debt.remaining),
      status: debt.status,
      due_date: debt.due_date ?? '',
    })
    setPayDraft({
      debtId: debt.id,
      amount: String(debt.remaining),
      occurred_at: toDateInputValue(),
      account_id: accountOptions[0]?.value ?? '',
      createTransaction: Boolean(accountOptions[0]),
    })
    setFormError(null)
    setSheetOpen(true)
  }

  async function handleSaveDebt() {
    if (!userId) {
      setFormError('Inicia sesión para guardar deudas.')
      return
    }
    const person = draft.person_name.trim()
    if (!person) {
      setFormError('Indica la persona o entidad.')
      return
    }
    const principal = Number(draft.principal.replace(',', '.'))
    const remaining = Number(draft.remaining.replace(',', '.'))
    if (!Number.isFinite(principal) || principal < 0) {
      setFormError('Principal no válido.')
      return
    }
    if (!Number.isFinite(remaining) || remaining < 0) {
      setFormError('Pendiente no válido.')
      return
    }
    if (remaining > principal) {
      setFormError('El pendiente no puede superar el principal.')
      return
    }

    setSaving(true)
    setFormError(null)
    const wasEdit = Boolean(draft.id)
    try {
      const status = remaining <= 0 ? 'settled' : draft.status === 'settled' ? 'pending' : draft.status
      const due_date = draft.due_date.trim() || null
      if (draft.id) {
        await updateDebt(draft.id, {
          direction: draft.direction,
          person_name: person,
          principal,
          remaining,
          status,
          due_date,
        })
      } else {
        await createDebt({
          user_id: userId,
          direction: draft.direction,
          person_name: person,
          principal,
          remaining: remaining || principal,
          status: remaining <= 0 && remaining !== principal ? 'settled' : 'pending',
          due_date,
        })
      }
      setSheetOpen(false)
      toast.success(wasEdit ? 'Deuda actualizada' : 'Deuda creada')
      await onChanged()
    } catch (err) {
      setFormError(err instanceof MoneyApiError || err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function handlePay() {
    if (!userId || !payDraft || !draft.id) return
    const debt = debts.find((d) => d.id === draft.id)
    if (!debt) return
    const amount = Number(payDraft.amount.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Importe no válido.')
      return
    }
    if (payDraft.createTransaction && !payDraft.account_id) {
      setFormError('Elige una cuenta para el movimiento.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      await recordDebtPayment({
        userId,
        debt,
        amount,
        occurredAt: payDraft.occurred_at,
        accountId: payDraft.account_id || undefined,
        createTransaction: payDraft.createTransaction,
      })
      setSheetOpen(false)
      toast.success('Pago registrado')
      await onChanged()
    } catch (err) {
      setFormError(err instanceof MoneyApiError || err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!draft.id) return
    if (!window.confirm('¿Eliminar esta deuda y sus pagos?')) return
    setSaving(true)
    setFormError(null)
    try {
      await deleteDebt(draft.id)
      setSheetOpen(false)
      toast.success('Deuda eliminada')
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
          <h2 style={{ fontSize: '1rem', margin: 0 }}>Deudas</h2>
          <p className="muted" style={{ fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
            Lo que debes y lo que te deben, con registro de pagos.
          </p>
        </div>
        <Button size="sm" onClick={openCreate} disabled={!configured || !userId}>
          Nueva
        </Button>
      </div>

      <Input
        label="Buscar"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Nombre de la persona"
      />

      <div className="chip-row">
        {(
          [
            ['all', 'Todas'],
            ['owe', 'Debo'],
            ['owed', 'Me deben'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`chip${directionTab === value ? ' chip-active' : ''}`}
            onClick={() => setDirectionTab(value)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className={`chip${showSettled ? ' chip-active' : ''}`}
          onClick={() => setShowSettled((v) => !v)}
        >
          Incluir saldadas
        </button>
      </div>

      <div key={`${directionTab}-${showSettled}`} className="subsection-enter">
        {loading ? (
          <MoneyListSkeleton rows={3} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="Sin deudas"
            description="Registra un préstamo o un favor pendiente."
            action={
              <Button size="sm" onClick={openCreate} disabled={!configured || !userId}>
                Añadir deuda
              </Button>
            }
          />
        ) : (
          <div className="money-list">
            {visible.map((debt) => {
              const paid = Math.max(0, debt.principal - debt.remaining)
              const ratio = debt.principal > 0 ? paid / debt.principal : 0
              return (
                <div key={debt.id} className="money-row money-row-stack money-row-static">
                  <span
                    className="money-dot"
                    style={{
                      background: debt.direction === 'owe' ? '#f87171' : 'var(--accent)',
                    }}
                  />
                  <span className="money-row-main">
                    <button type="button" className="linkish" onClick={() => openEdit(debt)}>
                      <strong>{debt.person_name}</strong>
                    </button>
                    <span className="muted">
                      {DEBT_DIRECTION_LABELS[debt.direction]} · {DEBT_STATUS_LABELS[debt.status]} ·{' '}
                      {formatMoney(debt.remaining, currency)} pendiente
                      {debt.due_date ? ` · vence ${debt.due_date}` : ''}
                    </span>
                    <ProgressBar
                      ratio={ratio}
                      tone={debt.status === 'settled' ? 'success' : 'accent'}
                      label={`${Math.round(ratio * 100)}%`}
                    />
                    {debt.status === 'pending' ? (
                      <div className="row-actions">
                        <Button size="sm" variant="secondary" onClick={() => openPay(debt)}>
                          Registrar pago
                        </Button>
                      </div>
                    ) : null}
                  </span>
                  <span className="amount">{formatMoney(debt.principal, currency)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Sheet
        open={sheetOpen}
        title={
          mode === 'pay'
            ? `Pago · ${draft.person_name}`
            : draft.id
              ? 'Editar deuda'
              : 'Nueva deuda'
        }
        onClose={() => setSheetOpen(false)}
        footer={
          <div className="form-actions">
            {mode === 'edit' && draft.id ? (
              <Button variant="destructive" size="sm" onClick={() => void handleDelete()} disabled={saving}>
                Eliminar
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => setSheetOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={() => void (mode === 'pay' ? handlePay() : handleSaveDebt())}
              disabled={saving}
            >
              {saving ? 'Guardando…' : mode === 'pay' ? 'Registrar' : 'Guardar'}
            </Button>
          </div>
        }
      >
        <div className="money-form">
          <ErrorBanner message={formError} />

          {mode === 'pay' && payDraft ? (
            <>
              <p className="muted" style={{ margin: 0 }}>
                Pendiente: {formatMoney(Number(draft.remaining) || 0, currency)}
              </p>
              <Input
                label="Importe del pago"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={payDraft.amount}
                onChange={(e) => setPayDraft((p) => (p ? { ...p, amount: e.target.value } : p))}
              />
              <Input
                label="Fecha"
                type="date"
                value={payDraft.occurred_at}
                onChange={(e) =>
                  setPayDraft((p) => (p ? { ...p, occurred_at: e.target.value } : p))
                }
              />
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={payDraft.createTransaction}
                  onChange={(e) =>
                    setPayDraft((p) => (p ? { ...p, createTransaction: e.target.checked } : p))
                  }
                />
                Registrar movimiento en una cuenta
              </label>
              {payDraft.createTransaction ? (
                <Select
                  label="Cuenta"
                  value={payDraft.account_id}
                  onChange={(e) =>
                    setPayDraft((p) => (p ? { ...p, account_id: e.target.value } : p))
                  }
                  options={accountOptions}
                  placeholder="Elige cuenta"
                />
              ) : null}
            </>
          ) : (
            <>
              <div className="chip-row">
                {(['owe', 'owed'] as DebtDirection[]).map((dir) => (
                  <button
                    key={dir}
                    type="button"
                    className={`chip${draft.direction === dir ? ' chip-active' : ''}`}
                    onClick={() => setDraft((d) => ({ ...d, direction: dir }))}
                  >
                    {DEBT_DIRECTION_LABELS[dir]}
                  </button>
                ))}
              </div>
              <Input
                label="Persona o entidad"
                value={draft.person_name}
                onChange={(e) => setDraft((d) => ({ ...d, person_name: e.target.value }))}
              />
              <Input
                label="Importe total"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={draft.principal}
                onChange={(e) => {
                  const value = e.target.value
                  setDraft((d) => ({
                    ...d,
                    principal: value,
                    remaining: d.id ? d.remaining : value,
                  }))
                }}
              />
              <Input
                label="Pendiente"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={draft.remaining}
                onChange={(e) => setDraft((d) => ({ ...d, remaining: e.target.value }))}
              />
              <Input
                label="Fecha de vencimiento (opcional)"
                type="date"
                value={draft.due_date}
                onChange={(e) => setDraft((d) => ({ ...d, due_date: e.target.value }))}
              />
              {draft.id && draft.status === 'pending' ? (
                <Button variant="secondary" size="sm" onClick={() => {
                  const debt = debts.find((d) => d.id === draft.id)
                  if (debt) openPay(debt)
                }}>
                  Registrar pago…
                </Button>
              ) : null}
            </>
          )}
        </div>
      </Sheet>
    </div>
  )
}
