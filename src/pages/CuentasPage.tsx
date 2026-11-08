import { useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useMoneyData } from '@/hooks/useMoneyData'
import { ConfigBanner } from '@/components/money/ConfigBanner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ColorField } from '@/components/ui/ColorField'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Sheet } from '@/components/ui/Sheet'
import { formatMoney } from '@/lib/currency'
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_OPTIONS } from '@/lib/labels'
import {
  createAccount,
  deleteAccount,
  MoneyApiError,
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
  const [sheetOpen, setSheetOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  const visible = useMemo(
    () => money.accounts.filter((a) => showInactive || a.is_active),
    [money.accounts, showInactive],
  )

  function openCreate() {
    setDraft(emptyDraft())
    setFormError(null)
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
          <p className="muted">Cargando cuentas…</p>
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
            hint="El saldo actual se deriva de este valor más movimientos y transferencias."
          />
          <label className="check-row">
            <input
              type="checkbox"
              className="checkbox"
              checked={draft.is_active}
              onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))}
            />
            <span>Cuenta activa</span>
          </label>

          <ErrorBanner message={formError} />

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
        </div>
      </Sheet>
    </main>
  )
}
