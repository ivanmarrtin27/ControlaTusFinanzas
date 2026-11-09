import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { parseUserAmount } from '@/lib/currency'
import { dateInputToIso, toDateInputValue } from '@/lib/dates'
import { accountOptionLabel } from '@/lib/labels'
import type { Account, Transfer } from '@/types/database'

interface TransferFormProps {
  accounts: Account[]
  initial?: Partial<Transfer>
  submitLabel: string
  onSubmit: (values: {
    from_account_id: string
    to_account_id: string
    amount: number
    concept: string | null
    occurred_at: string
  }) => Promise<void>
  onCancel: () => void
  formId?: string
  showActions?: boolean
  onBusyChange?: (busy: boolean) => void
}

export function TransferForm({
  accounts,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  formId,
  showActions = true,
  onBusyChange,
}: TransferFormProps) {
  const active = accounts.filter(
    (a) => a.is_active || a.id === initial?.from_account_id || a.id === initial?.to_account_id,
  )
  const [fromId, setFromId] = useState(initial?.from_account_id ?? active[0]?.id ?? '')
  const [toId, setToId] = useState(
    initial?.to_account_id ??
      active.find((a) => a.id !== (initial?.from_account_id ?? active[0]?.id))?.id ??
      '',
  )
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '')
  const [concept, setConcept] = useState(initial?.concept ?? '')
  const [occurredAt, setOccurredAt] = useState(toDateInputValue(initial?.occurred_at ?? new Date()))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const options = active.map((a) => ({ value: a.id, label: accountOptionLabel(a) }))

  useEffect(() => {
    onBusyChange?.(saving)
  }, [saving, onBusyChange])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const n = parseUserAmount(amount)
    if (n == null || !(n > 0)) {
      setError('Introduce un importe mayor que 0 (puedes usar coma o punto).')
      return
    }
    if (!fromId || !toId) {
      setError('Selecciona cuenta origen y destino.')
      return
    }
    if (fromId === toId) {
      setError('Elige dos cuentas distintas.')
      return
    }
    if (options.length < 2) {
      setError('Necesitas al menos dos cuentas activas para transferir.')
      return
    }
    if (!occurredAt) {
      setError('Selecciona una fecha.')
      return
    }

    setSaving(true)
    try {
      await onSubmit({
        from_account_id: fromId,
        to_account_id: toId,
        amount: n,
        concept: concept.trim() || null,
        occurred_at: dateInputToIso(occurredAt),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la transferencia.')
      setSaving(false)
      return
    }
    setSaving(false)
  }

  return (
    <form
      id={formId}
      className="money-form transfer-form"
      onSubmit={(e) => void handleSubmit(e)}
      noValidate
    >
      <div className="transfer-route" role="group" aria-label="Cuentas de la transferencia">
        <Select
          label="Desde"
          name="from_account_id"
          value={fromId}
          onChange={(e) => setFromId(e.target.value)}
          options={options}
        />
        <div className="transfer-route-connector" aria-hidden="true">
          <span className="transfer-route-arrow">↓</span>
        </div>
        <Select
          label="Hacia"
          name="to_account_id"
          value={toId}
          onChange={(e) => setToId(e.target.value)}
          options={options}
        />
      </div>

      <Input
        label="Importe"
        name="amount"
        inputMode="decimal"
        placeholder="0,00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        autoComplete="off"
      />
      <Input
        label="Fecha"
        name="occurred_at"
        type="date"
        value={occurredAt}
        onChange={(e) => setOccurredAt(e.target.value)}
      />
      <Input
        label="Concepto (opcional)"
        name="concept"
        value={concept}
        onChange={(e) => setConcept(e.target.value)}
        placeholder="Transferencia"
      />

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      {showActions ? (
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || options.length < 2}>
            {saving ? 'Guardando…' : submitLabel}
          </Button>
        </div>
      ) : null}
    </form>
  )
}
