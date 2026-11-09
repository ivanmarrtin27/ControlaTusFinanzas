import { useMemo, useState } from 'react'
import { DeltaBadge } from '@/components/money/DeltaBadge'
import { ConfigBanner } from '@/components/money/ConfigBanner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ColorField } from '@/components/ui/ColorField'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Sheet } from '@/components/ui/Sheet'
import { MoneyListSkeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useMoneyData } from '@/hooks/useMoneyData'
import { formatMoney } from '@/lib/currency'
import {
  accountDeltaSince,
  formatDeltaAbsolute,
  monthStartAsOf,
  reconcileDiff,
} from '@/lib/delta'
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_OPTIONS } from '@/lib/labels'
import {
  createAccount,
  deleteAccount,
  MoneyApiError,
  reconcileAccountBalance,
  updateAccount,
} from '@/lib/moneyApi'
import type { Account, AccountType } from '@/types/database'

type Draft = {
  id?: string
  name: string
  type: AccountType
  color: string
  opening_balance: string
  is_active: boolean
}

const emptyDraft = (): Draft => ({
  name: '',
  type: 'bank',
  color: '#1DB954',
  opening_balance: '0',
  is_active: true,
})

export function CuentasPage() {
  const { profile } = useAuth()
  const currency = profile?.currency ?? 'EUR'
  const money = useMoneyData()
  const toast = useToast()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [reconcileMode, setReconcileMode] = useState(false)
  const [targetBalance, setTargetBalance] = useState('')

  const monthStart = useMemo(() => monthStartAsOf(), [])

  const visible = useMemo(
    () => money.accounts.filter((a) => showInactive || a.is_active),
    [money.accounts, showInactive],
  )

  const accountMonthDeltas = useMemo(() => {
    const map = new Map<string, ReturnType<typeof accountDeltaSince>>()
    for (const account of money.accounts) {
      const current = money.balancesByAccount.get(account.id) ?? 0
      map.set(
        account.id,
        accountDeltaSince(
          account,
          current,
          money.transactions,
          money.transfers,
          monthStart,
        ),
      )
    }
    return map
  }, [money.accounts, money.balancesByAccount, money.transactions, money.transfers, monthStart])

  const editingBalance = draft.id
    ? (money.balancesByAccount.get(draft.id) ?? 0)
    : null

  const reconcilePreview = useMemo(() => {
    if (editingBalance == null) return null
    const target = Number(targetBalance.replace(',', '.'))
    if (!Number.isFinite(target)) return null
    return reconcileDiff(editingBalance, target)
  }, [editingBalance, targetBalance])

  function openCreate() {
    setDraft(emptyDraft())
    setFormError(null)
    setReconcileMode(false)
    setTargetBalance('')
    setSheetOpen(true)
  }

  function openEdit(account: Account) {
    setDraft({
      id: account.id,
      name: account.name,
      type: account.type,
      color: account.color,
      opening_balance: String(account.opening_balance),
      is_active: account.is_active,
    })
    setFormError(null)
    setReconcileMode(false)
    setTargetBalance(String(money.balancesByAccount.get(account.id) ?? 0))
    setSheetOpen(true)
  }

  async function handleSave() {
    if (!money.userId) {
      setFormError('Inicia sesión para guardar cuentas.')
      return
    }
    const name = draft.name.trim()
    if (!name) {
      setFormError('El nombre es obligatorio.')
      return
    }
    const opening = Number(draft.opening_balance.replace(',', '.'))
    if (!Number.isFinite(opening)) {
      setFormError('Saldo inicial no válido.')
      return
    }

    setSaving(true)
    setFormError(null)
    const wasEdit = Boolean(draft.id)
    try {
      if (draft.id) {
        await updateAccount(draft.id, {
          name,
          type: draft.type,
          color: draft.color,
          opening_balance: opening,
          is_active: draft.is_active,
        })
      } else {
        await createAccount({
          user_id: money.userId,
          name,
          type: draft.type,
          color: draft.color,
          opening_balance: opening,
          is_active: draft.is_active,
        })
      }
      setSheetOpen(false)
      toast.success(wasEdit ? 'Cuenta actualizada' : 'Cuenta creada')
      await money.refresh()
    } catch (err) {
      setFormError(err instanceof MoneyApiError || err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function handleReconcile() {
    if (!money.userId || !draft.id || editingBalance == null) return
    const target = Number(targetBalance.replace(',', '.'))
    if (!Number.isFinite(target)) {
      setFormError('Saldo objetivo no válido.')
      return
    }
    const diff = reconcileDiff(editingBalance, target)
    if (Math.abs(diff) < 0.005) {
      setFormError('El saldo ya coincide; no hace falta ajuste.')
      return
    }

    const signed = formatDeltaAbsolute(diff, currency)
    const ok = window.confirm(
      `Se creará un movimiento «Ajuste de saldo» de ${signed} para que el saldo pase de ${formatMoney(editingBalance, currency)} a ${formatMoney(target, currency)}.\n\nNo se borran movimientos anteriores. ¿Continuar?`,
    )
    if (!ok) return

    setSaving(true)
    setFormError(null)
    try {
      const created = await reconcileAccountBalance({
        userId: money.userId,
        accountId: draft.id,
        currentBalance: editingBalance,
        targetBalance: target,
      })
      if (!created) {
        setFormError('El saldo ya coincide; no hace falta ajuste.')
        return
      }
      setReconcileMode(false)
      setSheetOpen(false)
      toast.success('Saldo actualizado con ajuste')
      await money.refresh()
    } catch (err) {
      setFormError(err instanceof MoneyApiError || err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!draft.id) return
    if (!window.confirm('¿Eliminar esta cuenta? Solo es posible si no tiene movimientos ni transferencias.')) {
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await deleteAccount(draft.id)
      setSheetOpen(false)
      toast.success('Cuenta eliminada')
      await money.refresh()
    } catch (err) {
      setFormError(
        err instanceof Error
          ? `${err.message} (desactívala si tiene historial).`
          : 'No se pudo eliminar.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page">
      <header className="page-header page-header-row">
        <div>
          <h1>Cuentas</h1>
          <p className="page-header-lead">Bancarias, efectivo, tarjetas y otras.</p>
        </div>
        <Button onClick={openCreate} disabled={!money.configured || !money.userId}>
          Nueva
        </Button>
      </header>

      <div className="stack-md">
        <ConfigBanner configured={money.configured} error={money.error} />

        <div className="chip-row">
          <button
            type="button"
            className={`chip${!showInactive ? ' chip-active' : ''}`}
            onClick={() => setShowInactive(false)}
          >
            Activas
          </button>
          <button
            type="button"
            className={`chip${showInactive ? ' chip-active' : ''}`}
            onClick={() => setShowInactive(true)}
          >
            Todas
          </button>
        </div>

        {money.loading ? (
          <MoneyListSkeleton rows={4} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="Sin cuentas"
            description="Crea tu primera cuenta para empezar a registrar movimientos."
            action={
              <Button onClick={openCreate} disabled={!money.configured || !money.userId}>
                Crear cuenta
              </Button>
            }
          />
        ) : (
          <div className="money-list">
            {visible.map((account) => {
              const balance = money.balancesByAccount.get(account.id) ?? 0
              const monthDelta = accountMonthDeltas.get(account.id)
              return (
                <button
                  key={account.id}
                  type="button"
                  className="money-row"
                  onClick={() => openEdit(account)}
                >
                  <span className="money-dot" style={{ background: account.color }} />
                  <span className="money-row-main">
                    <strong>{account.name}</strong>
                    <span className="muted">
                      {ACCOUNT_TYPE_LABELS[account.type]}
                      {!account.is_active ? ' · Inactiva' : ''}
                    </span>
                    {monthDelta ? (
                      <span className="money-row-delta">
                        <DeltaBadge
                          delta={monthDelta}
                          currency={currency}
                          label="este mes"
                          compact
                        />
                      </span>
                    ) : null}
                  </span>
                  <span className="amount">{formatMoney(balance, currency)}</span>
                </button>
              )
            })}
          </div>
        )}

        <Card>
          <p className="label muted" style={{ fontSize: '0.75rem', marginBottom: '0.35rem' }}>
            Patrimonio (cuentas activas)
          </p>
          <p className="amount" style={{ fontSize: '1.35rem', margin: 0 }}>
            {formatMoney(money.totalBalance, currency)}
          </p>
          <p className="muted" style={{ fontSize: '0.75rem', marginTop: '0.45rem', lineHeight: 1.4 }}>
            El saldo de cada cuenta = saldo inicial + ingresos − gastos ± transferencias. Usa
            «Actualizar saldo» si el banco no coincide: se crea un ajuste sin borrar historial.
          </p>
        </Card>
      </div>

      <Sheet
        open={sheetOpen}
        title={draft.id ? 'Editar cuenta' : 'Nueva cuenta'}
        onClose={() => setSheetOpen(false)}
      >
        <div className="money-form">
          <Input
            label="Nombre"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            required
          />
          <Select
            label="Tipo"
            value={draft.type}
            onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as AccountType }))}
            options={ACCOUNT_TYPE_OPTIONS}
          />
          <ColorField
            label="Color"
            value={draft.color}
            onChange={(color) => setDraft((d) => ({ ...d, color }))}
          />
          <Input
            label="Saldo inicial"
            inputMode="decimal"
            value={draft.opening_balance}
            onChange={(e) => setDraft((d) => ({ ...d, opening_balance: e.target.value }))}
            hint="Punto de partida. El saldo actual se deriva de este valor más movimientos y transferencias."
          />
          {draft.id && editingBalance != null ? (
            <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
              Saldo actual derivado:{' '}
              <strong className="amount">{formatMoney(editingBalance, currency)}</strong>
            </p>
          ) : null}
          <label className="check-row">
            <input
              type="checkbox"
              className="checkbox"
              checked={draft.is_active}
              onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))}
            />
            <span>Cuenta activa</span>
          </label>

          {draft.id ? (
            <div className="reconcile-box">
              {!reconcileMode ? (
                <>
                  <p className="muted">
                    ¿El saldo del banco no coincide? Actualízalo sin reescribir el historial: se
                    crea un movimiento «Ajuste de saldo» por la diferencia.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setReconcileMode(true)
                      setTargetBalance(String(editingBalance ?? 0))
                      setFormError(null)
                    }}
                  >
                    Actualizar saldo
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    label="Saldo real (objetivo)"
                    inputMode="decimal"
                    value={targetBalance}
                    onChange={(e) => setTargetBalance(e.target.value)}
                    hint="Importe que quieres ver en la app tras el ajuste."
                  />
                  {reconcilePreview != null && Math.abs(reconcilePreview) >= 0.005 ? (
                    <p>
                      Diferencia:{' '}
                      <strong className={reconcilePreview > 0 ? 'amount-income' : 'amount-expense'}>
                        {formatDeltaAbsolute(reconcilePreview, currency)}
                      </strong>{' '}
                      → movimiento de {reconcilePreview > 0 ? 'ingreso' : 'gasto'} «Ajuste de saldo».
                    </p>
                  ) : (
                    <p className="muted">Introduce el saldo real para ver la diferencia.</p>
                  )}
                  <div className="form-actions">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setReconcileMode(false)
                        setFormError(null)
                      }}
                      disabled={saving}
                    >
                      Cancelar
                    </Button>
                    <Button type="button" onClick={() => void handleReconcile()} disabled={saving}>
                      {saving ? 'Ajustando…' : 'Confirmar ajuste'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : null}

          <ErrorBanner message={formError} />

          {!reconcileMode ? (
            <div className="form-actions">
              {draft.id ? (
                <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={saving}>
                  Eliminar
                </Button>
              ) : (
                <Button type="button" variant="secondary" onClick={() => setSheetOpen(false)}>
                  Cancelar
                </Button>
              )}
              <Button type="button" onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          ) : null}
        </div>
      </Sheet>
    </main>
  )
}
