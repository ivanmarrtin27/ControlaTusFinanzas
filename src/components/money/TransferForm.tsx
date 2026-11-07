import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { dateInputToIso, toDateInputValue } from '@/lib/dates'
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
}

export function TransferForm({
  accounts,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: TransferFormProps) {
  const active = accounts.filter((a) => a.is_active || a.id === initial?.from_account_id || a.id === initial?.to_account_id)
  const [fromId, setFromId] = useState(initial?.from_account_id ?? active[0]?.id ?? '')
  const [toId, setToId] = useState(
    initial?.to_account_id ?? active.find((a) => a.id !== (initial?.from_account_id ?? active[0]?.id))?.id ?? '',
  )
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '')
  const [concept, setConcept] = useState(initial?.concept ?? '')
  const [occurredAt, setOccurredAt] = useState(toDateInputValue(initial?.occurred_at ?? new Date()))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const options = active.map((a) => ({ value: a.id, label: a.name }))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const n = Number(amount.replace(',', '.'))
    if (!Number.isFinite(n) || n <= 0) {
      setError('Introduce un importe mayor que 0.')
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
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
      setSaving(false)
      return
    }
    setSaving(false)
  }

  return (
    <form className="money-form" onSubmit={(e) => void handleSubmit(e)}>
      <Select
        label="Desde"
        name="from_account_id"
        value={fromId}
        onChange={(e) => setFromId(e.target.value)}
        options={options}
        required
      />
      <Select
        label="Hacia"
        name="to_account_id"
        value={toId}
        onChange={(e) => setToId(e.target.value)}
        options={options}
        required
      />
      <Input
        label="Importe"
        name="amount"
        inputMode="decimal"
        placeholder="0,00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />
      <Input
        label="Concepto (opcional)"
        name="concept"
        value={concept}
        onChange={(e) => setConcept(e.target.value)}
        placeholder="Transferencia"
      />
      <Input
        label="Fecha"
        name="occurred_at"
        type="date"
        value={occurredAt}
        onChange={(e) => setOccurredAt(e.target.value)}
        required
      />

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving || options.length < 2}>
          {saving ? 'Guardando…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
