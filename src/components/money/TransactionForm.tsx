import { useState, type FormEvent } from 'react'
import { ReceiptField } from '@/components/money/ReceiptField'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { dateInputToIso, toDateInputValue } from '@/lib/dates'
import type { Account, Category, Tag, Transaction, TransactionType } from '@/types/database'

export interface TransactionFormValues {
  type: TransactionType
  amount: string
  concept: string
  note: string
  account_id: string
  category_id: string
  occurred_at: string
  tag_ids: string[]
}

export type TransactionSubmitValues = {
  type: TransactionType
  amount: number
  concept: string
  note: string | null
  account_id: string
  category_id: string | null
  occurred_at: string
  tag_ids: string[]
  receipt_file: File | null
  clear_receipt: boolean
}

interface TransactionFormProps {
  accounts: Account[]
  categories: Category[]
  tags?: Tag[]
  initial?: Partial<Transaction> & { type?: TransactionType; tag_ids?: string[] }
  submitLabel: string
  onSubmit: (values: TransactionSubmitValues) => Promise<void>
  onCancel: () => void
  /** When true, show receipt upload controls. */
  enableReceipt?: boolean
}

function buildInitial(
  accounts: Account[],
  categories: Category[],
  initial?: TransactionFormProps['initial'],
): TransactionFormValues {
  const type = initial?.type ?? 'expense'
  const activeAccounts = accounts.filter((a) => a.is_active)
  const cats = categories.filter((c) => c.is_active && c.kind === type)
  return {
    type,
    amount: initial?.amount != null ? String(initial.amount) : '',
    concept: initial?.concept ?? '',
    note: initial?.note ?? '',
    account_id: initial?.account_id ?? activeAccounts[0]?.id ?? '',
    category_id: initial?.category_id ?? cats[0]?.id ?? '',
    occurred_at: toDateInputValue(initial?.occurred_at ?? new Date()),
    tag_ids: initial?.tag_ids ?? [],
  }
}

export function TransactionForm({
  accounts,
  categories,
  tags = [],
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  enableReceipt = true,
}: TransactionFormProps) {
  const [values, setValues] = useState(() => buildInitial(accounts, categories, initial))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [clearReceipt, setClearReceipt] = useState(false)

  const categoryOptions = categories
    .filter((c) => c.is_active && c.kind === values.type)
    .map((c) => ({ value: c.id, label: c.name }))

  const accountOptions = accounts
    .filter((a) => a.is_active || a.id === values.account_id)
    .map((a) => ({ value: a.id, label: a.name }))

  function toggleTag(tagId: string) {
    setValues((v) => {
      const has = v.tag_ids.includes(tagId)
      return {
        ...v,
        tag_ids: has ? v.tag_ids.filter((id) => id !== tagId) : [...v.tag_ids, tagId],
      }
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const amount = Number(values.amount.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Introduce un importe mayor que 0.')
      return
    }
    if (!values.concept.trim()) {
      setError('El concepto es obligatorio.')
      return
    }
    if (!values.account_id) {
      setError('Selecciona una cuenta.')
      return
    }

    setSaving(true)
    try {
      await onSubmit({
        type: values.type,
        amount,
        concept: values.concept.trim(),
        note: values.note.trim() || null,
        account_id: values.account_id,
        category_id: values.category_id || null,
        occurred_at: dateInputToIso(values.occurred_at),
        tag_ids: values.tag_ids,
        receipt_file: receiptFile,
        clear_receipt: clearReceipt,
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
      <div className="chip-row" role="group" aria-label="Tipo de movimiento">
        <button
          type="button"
          className={`chip${values.type === 'expense' ? ' chip-active' : ''}`}
          onClick={() =>
            setValues((v) => {
              const nextCats = categories.filter((c) => c.is_active && c.kind === 'expense')
              return {
                ...v,
                type: 'expense',
                category_id: nextCats.some((c) => c.id === v.category_id)
                  ? v.category_id
                  : (nextCats[0]?.id ?? ''),
              }
            })
          }
        >
          Gasto
        </button>
        <button
          type="button"
          className={`chip${values.type === 'income' ? ' chip-active' : ''}`}
          onClick={() =>
            setValues((v) => {
              const nextCats = categories.filter((c) => c.is_active && c.kind === 'income')
              return {
                ...v,
                type: 'income',
                category_id: nextCats.some((c) => c.id === v.category_id)
                  ? v.category_id
                  : (nextCats[0]?.id ?? ''),
              }
            })
          }
        >
          Ingreso
        </button>
      </div>

      <Input
        label="Importe"
        name="amount"
        inputMode="decimal"
        placeholder="0,00"
        value={values.amount}
        onChange={(e) => setValues((v) => ({ ...v, amount: e.target.value }))}
        required
      />
      <Input
        label="Concepto"
        name="concept"
        value={values.concept}
        onChange={(e) => setValues((v) => ({ ...v, concept: e.target.value }))}
        required
      />
      <Select
        label="Cuenta"
        name="account_id"
        value={values.account_id}
        onChange={(e) => setValues((v) => ({ ...v, account_id: e.target.value }))}
        options={accountOptions}
        placeholder={accountOptions.length ? undefined : 'Crea una cuenta primero'}
        required
      />
      <Select
        label="Categoría"
        name="category_id"
        value={values.category_id}
        onChange={(e) => setValues((v) => ({ ...v, category_id: e.target.value }))}
        options={[
          { value: '', label: categoryOptions.length ? 'Sin categoría' : 'Sin categorías activas' },
          ...categoryOptions,
        ]}
      />

      {tags.length > 0 ? (
        <div className="field">
          <span className="field-label">Etiquetas</span>
          <div className="chip-row" role="group" aria-label="Etiquetas del movimiento">
            {tags.map((tag) => {
              const active = values.tag_ids.includes(tag.id)
              return (
                <button
                  key={tag.id}
                  type="button"
                  className={`chip${active ? ' chip-active' : ''}`}
                  style={
                    active
                      ? { borderColor: tag.color, background: `${tag.color}33` }
                      : { borderColor: tag.color }
                  }
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.name}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <Input
        label="Fecha"
        name="occurred_at"
        type="date"
        value={values.occurred_at}
        onChange={(e) => setValues((v) => ({ ...v, occurred_at: e.target.value }))}
        required
      />
      <Textarea
        label="Nota (opcional)"
        name="note"
        value={values.note}
        onChange={(e) => setValues((v) => ({ ...v, note: e.target.value }))}
      />

      {enableReceipt ? (
        <ReceiptField
          receiptPath={initial?.receipt_path ?? null}
          file={receiptFile}
          clearExisting={clearReceipt}
          onFileChange={(f) => {
            setReceiptFile(f)
            if (f) setClearReceipt(false)
          }}
          onClearExisting={() => setClearReceipt(true)}
        />
      ) : null}

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving || accountOptions.length === 0}>
          {saving ? 'Guardando…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
