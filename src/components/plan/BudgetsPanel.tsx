import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Sheet } from '@/components/ui/Sheet'
import { MoneyListSkeleton } from '@/components/ui/Skeleton'
import { ProgressBar } from '@/components/plan/ProgressBar'
import { useToast } from '@/contexts/ToastContext'
import { formatMoney } from '@/lib/currency'
import {
  createBudget,
  deleteBudget,
  updateBudget,
} from '@/lib/planApi'
import { MoneyApiError } from '@/lib/moneyApi'
import type { BudgetProgress } from '@/lib/planning'
import type { Category } from '@/types/database'

type Draft = {
  id?: string
  category_id: string
  amount_limit: string
}

const emptyDraft = (categoryId = ''): Draft => ({
  category_id: categoryId,
  amount_limit: '',
})

interface BudgetsPanelProps {
  currency: string
  userId: string | null
  configured: boolean
  loading: boolean
  periodLabel: string
  periodMonth: string
  progress: BudgetProgress[]
  expenseCategories: Category[]
  onChanged: () => Promise<void>
}

export function BudgetsPanel({
  currency,
  userId,
  configured,
  loading,
  periodLabel,
  periodMonth,
  progress,
  expenseCategories,
  onChanged,
}: BudgetsPanelProps) {
  const toast = useToast()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const usedCategoryIds = useMemo(
    () => new Set(progress.map((p) => p.budget.category_id)),
    [progress],
  )

  const categoryOptions = useMemo(() => {
    return expenseCategories
      .filter((c) => c.is_active || draft.category_id === c.id)
      .filter((c) => !usedCategoryIds.has(c.id) || c.id === draft.category_id)
      .map((c) => ({ value: c.id, label: c.name }))
  }, [expenseCategories, usedCategoryIds, draft.category_id])

  function openCreate() {
    const first = categoryOptions[0]?.value ?? ''
    setDraft(emptyDraft(first))
    setFormError(null)
    setSheetOpen(true)
  }

  function openEdit(item: BudgetProgress) {
    setDraft({
      id: item.budget.id,
      category_id: item.budget.category_id,
      amount_limit: String(item.budget.amount_limit),
    })
    setFormError(null)
    setSheetOpen(true)
  }

  async function handleSave() {
    if (!userId) {
      setFormError('Inicia sesión para guardar límites.')
      return
    }
    if (!draft.category_id) {
      setFormError('Elige una categoría.')
      return
    }
    const limit = Number(draft.amount_limit.replace(',', '.'))
    if (!Number.isFinite(limit) || limit < 0) {
      setFormError('Importe no válido.')
      return
    }

    setSaving(true)
    setFormError(null)
    const wasEdit = Boolean(draft.id)
    try {
      if (draft.id) {
        await updateBudget(draft.id, {
          category_id: draft.category_id,
          amount_limit: limit,
          period_month: periodMonth,
        })
      } else {
        await createBudget({
          user_id: userId,
          category_id: draft.category_id,
          amount_limit: limit,
          period_month: periodMonth,
        })
      }
      setSheetOpen(false)
      toast.success(wasEdit ? 'Límite actualizado' : 'Límite creado')
      await onChanged()
    } catch (err) {
      setFormError(err instanceof MoneyApiError || err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!draft.id) return
    if (!window.confirm('¿Eliminar este límite del mes?')) return
    setSaving(true)
    setFormError(null)
    try {
      await deleteBudget(draft.id)
      setSheetOpen(false)
      toast.success('Límite eliminado')
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
          <h2 style={{ fontSize: '1rem', margin: 0 }}>Límites · {periodLabel}</h2>
          <p className="muted" style={{ fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
            Presupuesto por categoría de gasto frente a lo gastado este mes.
          </p>
        </div>
        <Button size="sm" onClick={openCreate} disabled={!configured || !userId}>
          Nuevo
        </Button>
      </div>

      {loading ? (
        <MoneyListSkeleton rows={3} />
      ) : progress.length === 0 ? (
        <EmptyState
          title="Sin límites este mes"
          description="Define un tope por categoría para ver el progreso de gasto."
          action={
            <Button size="sm" onClick={openCreate} disabled={!configured || !userId}>
              Crear límite
            </Button>
          }
        />
      ) : (
        <div className="money-list">
          {progress.map((item) => {
            const tone = item.overLimit ? 'danger' : item.nearLimit ? 'warn' : 'accent'
            return (
              <button
                key={item.budget.id}
                type="button"
                className="money-row money-row-stack"
                onClick={() => openEdit(item)}
              >
                <span
                  className="money-dot"
                  style={{ background: item.category?.color ?? 'var(--accent)' }}
                />
                <span className="money-row-main">
                  <strong>{item.category?.name ?? 'Categoría'}</strong>
                  <span className="muted">
                    {formatMoney(item.spent, currency)} de {formatMoney(item.limit, currency)}
                    {item.overLimit ? ' · Superado' : item.nearLimit ? ' · Cerca del límite' : ''}
                  </span>
                  <ProgressBar
                    ratio={item.ratio}
                    tone={tone}
                    label={`${Math.round(item.ratio * 100)}%`}
                  />
                </span>
                <span className={`amount${item.remaining < 0 ? ' amount-expense' : ''}`}>
                  {formatMoney(item.remaining, currency)}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <Sheet
        open={sheetOpen}
        title={draft.id ? 'Editar límite' : 'Nuevo límite'}
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
          <Select
            label="Categoría"
            value={draft.category_id}
            onChange={(e) => setDraft((d) => ({ ...d, category_id: e.target.value }))}
            options={categoryOptions}
            placeholder={categoryOptions.length ? undefined : 'No hay categorías disponibles'}
          />
          <Input
            label="Límite mensual"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={draft.amount_limit}
            onChange={(e) => setDraft((d) => ({ ...d, amount_limit: e.target.value }))}
          />
          <p className="field-hint">Periodo: {periodLabel} (día 1 del mes).</p>
        </div>
      </Sheet>
    </div>
  )
}
