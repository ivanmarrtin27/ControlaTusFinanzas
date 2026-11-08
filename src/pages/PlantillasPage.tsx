import { useCallback, useEffect, useState } from 'react'
import { ConfigBanner } from '@/components/money/ConfigBanner'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Sheet } from '@/components/ui/Sheet'
import { MoneyListSkeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useMoneyData } from '@/hooks/useMoneyData'
import { formatMoney } from '@/lib/currency'
import { MoneyApiError } from '@/lib/moneyApi'
import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  seedExampleTemplates,
  updateTemplate,
} from '@/lib/templateApi'
import type { TransactionTemplate, TransactionType } from '@/types/database'

type Draft = {
  id?: string
  name: string
  type: TransactionType
  amount: string
  account_id: string
  category_id: string
  note: string
  sort_order: string
}

const emptyDraft = (): Draft => ({
  name: '',
  type: 'expense',
  amount: '',
  account_id: '',
  category_id: '',
  note: '',
  sort_order: '0',
})

export function PlantillasPage() {
  const { profile } = useAuth()
  const currency = profile?.currency ?? 'EUR'
  const money = useMoneyData()
  const toast = useToast()
  const [templates, setTemplates] = useState<TransactionTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    if (!money.userId || !money.configured) {
      setTemplates([])
      setLoading(false)
      return
    }
    setLoading(true)
    setListError(null)
    try {
      setTemplates(await listTemplates(money.userId))
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'No se pudieron cargar las plantillas.')
    } finally {
      setLoading(false)
    }
  }, [money.userId, money.configured])

  useEffect(() => {
    void refresh()
  }, [refresh])

  function openCreate() {
    setDraft({
      ...emptyDraft(),
      account_id: money.activeAccounts[0]?.id ?? '',
    })
    setFormError(null)
    setSheetOpen(true)
  }

  function openEdit(tpl: TransactionTemplate) {
    setDraft({
      id: tpl.id,
      name: tpl.name,
      type: tpl.type,
      amount: String(tpl.amount),
      account_id: tpl.account_id ?? '',
      category_id: tpl.category_id ?? '',
      note: tpl.note ?? '',
      sort_order: String(tpl.sort_order),
    })
    setFormError(null)
    setSheetOpen(true)
  }

  async function handleSave() {
    if (!money.userId) {
      setFormError('Inicia sesión para guardar plantillas.')
      return
    }
    const name = draft.name.trim()
    if (!name) {
      setFormError('El nombre es obligatorio.')
      return
    }
    const amount = Number(draft.amount.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Introduce un importe mayor que 0.')
      return
    }

    setSaving(true)
    setFormError(null)
    const wasEdit = Boolean(draft.id)
    try {
      const payload = {
        name,
        type: draft.type,
        amount,
        account_id: draft.account_id || null,
        category_id: draft.category_id || null,
        note: draft.note.trim() || null,
        sort_order: Number.parseInt(draft.sort_order, 10) || 0,
      }
      if (draft.id) {
        await updateTemplate(draft.id, payload)
      } else {
        await createTemplate({ ...payload, user_id: money.userId })
      }
      setSheetOpen(false)
      toast.success(wasEdit ? 'Plantilla actualizada' : 'Plantilla creada')
      await refresh()
    } catch (err) {
      setFormError(err instanceof MoneyApiError ? err.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!draft.id) return
    if (!window.confirm('¿Eliminar esta plantilla?')) return
    setSaving(true)
    setFormError(null)
    try {
      await deleteTemplate(draft.id)
      setSheetOpen(false)
      toast.success('Plantilla eliminada')
      await refresh()
    } catch (err) {
      setFormError(err instanceof MoneyApiError ? err.message : 'No se pudo eliminar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSeedExamples() {
    if (!money.userId) return
    setSaving(true)
    setListError(null)
    try {
      await seedExampleTemplates(money.userId)
      toast.success('Ejemplos añadidos')
      await refresh()
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'No se pudieron crear los ejemplos.')
    } finally {
      setSaving(false)
    }
  }

  const categoryOptions = money.categories
    .filter((c) => c.is_active && c.kind === draft.type)
    .map((c) => ({ value: c.id, label: c.name }))

  const accountOptions = [
    { value: '', label: 'Sin cuenta fija' },
    ...money.accounts
      .filter((a) => a.is_active || a.id === draft.account_id)
      .map((a) => ({ value: a.id, label: a.name })),
  ]

  return (
    <main className="page">
      <header className="page-header page-header-row">
        <div>
          <h1>Plantillas</h1>
          <p className="page-header-lead">Prefills de movimientos habituales.</p>
        </div>
        <Button size="sm" onClick={openCreate} disabled={!money.userId}>
          Nueva
        </Button>
      </header>

      <div className="stack-md">
        <ConfigBanner configured={money.configured} error={money.error ?? listError} />

        {loading ? (
          <MoneyListSkeleton rows={4} />
        ) : templates.length === 0 ? (
          <EmptyState
            title="Sin plantillas"
            description="Crea plantillas como «Café» o «Nómina» y aplícalas desde Movimientos o Inicio."
            action={
              <div className="header-actions">
                <Button size="sm" variant="secondary" onClick={() => void handleSeedExamples()} disabled={saving}>
                  Añadir ejemplos
                </Button>
                <Button size="sm" onClick={openCreate}>
                  Crear plantilla
                </Button>
              </div>
            }
          />
        ) : (
          <div className="money-list">
            {templates.map((tpl) => {
              const account = tpl.account_id ? money.accountsById.get(tpl.account_id) : undefined
              const category = tpl.category_id
                ? money.categoriesById.get(tpl.category_id)
                : undefined
              return (
                <button
                  key={tpl.id}
                  type="button"
                  className="money-row"
                  onClick={() => openEdit(tpl)}
                >
                  <span
                    className="money-dot"
                    style={{
                      background: category?.color ?? account?.color ?? 'var(--accent)',
                    }}
                  />
                  <span className="money-row-main">
                    <strong>{tpl.name}</strong>
                    <span className="muted">
                      {tpl.type === 'income' ? 'Ingreso' : 'Gasto'}
                      {account ? ` · ${account.name}` : ''}
                      {category ? ` · ${category.name}` : ''}
                    </span>
                  </span>
                  <span
                    className={`amount${tpl.type === 'expense' ? ' amount-expense' : ' amount-income'}`}
                  >
                    {formatMoney(tpl.amount, currency)}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <Sheet
        open={sheetOpen}
        title={draft.id ? 'Editar plantilla' : 'Nueva plantilla'}
        onClose={() => setSheetOpen(false)}
        footer={
          draft.id ? (
            <Button variant="destructive" block onClick={() => void handleDelete()} disabled={saving}>
              Eliminar plantilla
            </Button>
          ) : null
        }
      >
        <div className="money-form">
          <Input
            label="Nombre"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            required
          />
          <div className="chip-row" role="group" aria-label="Tipo">
            <button
              type="button"
              className={`chip${draft.type === 'expense' ? ' chip-active' : ''}`}
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  type: 'expense',
                  category_id: '',
                }))
              }
            >
              Gasto
            </button>
            <button
              type="button"
              className={`chip${draft.type === 'income' ? ' chip-active' : ''}`}
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  type: 'income',
                  category_id: '',
                }))
              }
            >
              Ingreso
            </button>
          </div>
          <Input
            label="Importe"
            inputMode="decimal"
            value={draft.amount}
            onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
            required
          />
          <Select
            label="Cuenta (opcional)"
            value={draft.account_id}
            onChange={(e) => setDraft((d) => ({ ...d, account_id: e.target.value }))}
            options={accountOptions}
          />
          <Select
            label="Categoría (opcional)"
            value={draft.category_id}
            onChange={(e) => setDraft((d) => ({ ...d, category_id: e.target.value }))}
            options={[
              { value: '', label: 'Sin categoría' },
              ...categoryOptions,
            ]}
          />
          <Textarea
            label="Nota (opcional)"
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
          />
          <Input
            label="Orden"
            inputMode="numeric"
            value={draft.sort_order}
            onChange={(e) => setDraft((d) => ({ ...d, sort_order: e.target.value }))}
          />
          <ErrorBanner message={formError} />
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={() => setSheetOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Sheet>
    </main>
  )
}
