import { useMemo, useState } from 'react'
import { useMoneyData } from '@/hooks/useMoneyData'
import { ConfigBanner } from '@/components/money/ConfigBanner'
import { Button } from '@/components/ui/Button'
import { ColorField } from '@/components/ui/ColorField'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Sheet } from '@/components/ui/Sheet'
import { CATEGORY_KIND_LABELS } from '@/lib/labels'
import {
  createCategory,
  deleteCategory,
  MoneyApiError,
  updateCategory,
} from '@/lib/moneyApi'
import type { Category, CategoryKind } from '@/types/database'

type Draft = {
  id?: string
  name: string
  kind: CategoryKind
  color: string
  is_active: boolean
  is_system?: boolean
}

const emptyDraft = (kind: CategoryKind = 'expense'): Draft => ({
  name: '',
  kind,
  color: '#1DB954',
  is_active: true,
})

export function CategoriasPage() {
  const money = useMoneyData()
  const [kindTab, setKindTab] = useState<CategoryKind>('expense')
  const [showInactive, setShowInactive] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const visible = useMemo(
    () =>
      money.categories.filter(
        (c) => c.kind === kindTab && (showInactive || c.is_active),
      ),
    [money.categories, kindTab, showInactive],
  )

  function openCreate() {
    setDraft(emptyDraft(kindTab))
    setFormError(null)
    setSheetOpen(true)
  }

  function openEdit(category: Category) {
    setDraft({
      id: category.id,
      name: category.name,
      kind: category.kind,
      color: category.color,
      is_active: category.is_active,
      is_system: category.is_system,
    })
    setFormError(null)
    setSheetOpen(true)
  }

  async function handleSave() {
    if (!money.userId) {
      setFormError('Inicia sesión para guardar categorías.')
      return
    }
    const name = draft.name.trim()
    if (!name) {
      setFormError('El nombre es obligatorio.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      if (draft.id) {
        await updateCategory(draft.id, {
          name,
          kind: draft.kind,
          color: draft.color,
          is_active: draft.is_active,
        })
      } else {
        await createCategory({
          user_id: money.userId,
          name,
          kind: draft.kind,
          color: draft.color,
          is_active: draft.is_active,
          is_system: false,
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

  async function handleDeleteOrDisable() {
    if (!draft.id) return

    if (draft.is_system) {
      setSaving(true)
      try {
        await updateCategory(draft.id, { is_active: false })
        setSheetOpen(false)
        await money.refresh()
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'No se pudo desactivar.')
      } finally {
        setSaving(false)
      }
      return
    }

    if (!window.confirm('¿Eliminar esta categoría? Si tiene historial, desactívala en su lugar.')) {
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await deleteCategory(draft.id)
      setSheetOpen(false)
      await money.refresh()
    } catch (err) {
      try {
        await updateCategory(draft.id, { is_active: false })
        setSheetOpen(false)
        await money.refresh()
        setFormError(null)
      } catch {
        setFormError(err instanceof Error ? err.message : 'No se pudo eliminar.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page">
      <header className="page-header page-header-row">
        <div>
          <h1>Categorías</h1>
          <p className="page-header-lead">
            Organiza ingresos y gastos. Las semilla del sistema se pueden desactivar, no borrar.
          </p>
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
            className={`chip${kindTab === 'expense' ? ' chip-active' : ''}`}
            onClick={() => {
              setKindTab('expense')
              window.scrollTo(0, 0)
            }}
          >
            Gastos
          </button>
          <button
            type="button"
            className={`chip${kindTab === 'income' ? ' chip-active' : ''}`}
            onClick={() => {
              setKindTab('income')
              window.scrollTo(0, 0)
            }}
          >
            Ingresos
          </button>
          <button
            type="button"
            className={`chip${showInactive ? ' chip-active' : ''}`}
            onClick={() => setShowInactive((v) => !v)}
          >
            {showInactive ? 'Ocultar inactivas' : 'Ver inactivas'}
          </button>
        </div>

        <div key={kindTab} className="subsection-enter">
          {money.loading ? (
            <p className="muted">Cargando categorías…</p>
          ) : visible.length === 0 ? (
            <EmptyState
              title={`Sin categorías de ${CATEGORY_KIND_LABELS[kindTab].toLowerCase()}`}
              description="Crea una categoría o espera a que se siembren las predeterminadas al registrarte."
              action={<Button onClick={openCreate}>Crear categoría</Button>}
            />
          ) : (
            <div className="money-list">
              {visible.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className="money-row"
                  onClick={() => openEdit(category)}
                >
                  <span className="money-dot" style={{ background: category.color }} />
                  <span className="money-row-main">
                    <strong>{category.name}</strong>
                    <span className="muted">
                      {CATEGORY_KIND_LABELS[category.kind]}
                      {category.is_system ? ' · Sistema' : ''}
                      {!category.is_active ? ' · Inactiva' : ''}
                    </span>
                  </span>
                  <span className="muted">Editar</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Sheet
        open={sheetOpen}
        title={draft.id ? 'Editar categoría' : 'Nueva categoría'}
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
            value={draft.kind}
            onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as CategoryKind }))}
            options={[
              { value: 'expense', label: 'Gasto' },
              { value: 'income', label: 'Ingreso' },
            ]}
            disabled={Boolean(draft.is_system)}
          />
          <ColorField
            label="Color"
            value={draft.color}
            onChange={(color) => setDraft((d) => ({ ...d, color }))}
          />
          <label className="check-row">
            <input
              type="checkbox"
              className="checkbox"
              checked={draft.is_active}
              onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))}
            />
            <span>Categoría activa</span>
          </label>

          <ErrorBanner message={formError} />

          <div className="form-actions">
            {draft.id ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleDeleteOrDisable()}
                disabled={saving}
              >
                {draft.is_system ? 'Desactivar' : 'Eliminar'}
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
