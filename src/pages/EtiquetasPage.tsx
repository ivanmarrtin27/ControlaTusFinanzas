import { useState } from 'react'
import { ConfigBanner } from '@/components/money/ConfigBanner'
import { Button } from '@/components/ui/Button'
import { ColorField } from '@/components/ui/ColorField'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Input } from '@/components/ui/Input'
import { Sheet } from '@/components/ui/Sheet'
import { useMoneyData } from '@/hooks/useMoneyData'
import { MoneyApiError } from '@/lib/moneyApi'
import { createTag, deleteTag, updateTag } from '@/lib/tagApi'
import type { Tag } from '@/types/database'

type Draft = {
  id?: string
  name: string
  color: string
}

const emptyDraft = (): Draft => ({
  name: '',
  color: '#1DB954',
})

export function EtiquetasPage() {
  const money = useMoneyData()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function openCreate() {
    setDraft(emptyDraft())
    setFormError(null)
    setSheetOpen(true)
  }

  function openEdit(tag: Tag) {
    setDraft({ id: tag.id, name: tag.name, color: tag.color })
    setFormError(null)
    setSheetOpen(true)
  }

  async function handleSave() {
    if (!money.userId) {
      setFormError('Inicia sesión para guardar etiquetas.')
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
        await updateTag(draft.id, { name, color: draft.color })
      } else {
        await createTag({
          user_id: money.userId,
          name,
          color: draft.color,
        })
      }
      setSheetOpen(false)
      await money.refresh()
    } catch (err) {
      setFormError(err instanceof MoneyApiError ? err.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!draft.id) return
    if (!window.confirm('¿Eliminar esta etiqueta? Se quitará de los movimientos.')) return
    setSaving(true)
    setFormError(null)
    try {
      await deleteTag(draft.id)
      setSheetOpen(false)
      await money.refresh()
    } catch (err) {
      setFormError(err instanceof MoneyApiError ? err.message : 'No se pudo eliminar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page">
      <header className="page-header page-header-row">
        <div>
          <h1>Etiquetas</h1>
          <p className="page-header-lead">Tags para filtrar movimientos.</p>
        </div>
        <Button size="sm" onClick={openCreate} disabled={!money.userId}>
          Nueva
        </Button>
      </header>

      <div className="stack-md">
        <ConfigBanner configured={money.configured} error={money.error} />

        {money.loading ? (
          <p className="muted">Cargando…</p>
        ) : money.tags.length === 0 ? (
          <EmptyState
            title="Sin etiquetas"
            description="Crea etiquetas como «viaje», «trabajo» o «compartido» y asígnalas al registrar movimientos."
            action={
              <Button size="sm" onClick={openCreate}>
                Crear etiqueta
              </Button>
            }
          />
        ) : (
          <div className="money-list">
            {money.tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="money-row"
                onClick={() => openEdit(tag)}
              >
                <span className="money-dot" style={{ background: tag.color }} />
                <span className="money-row-main">
                  <strong>{tag.name}</strong>
                  <span className="muted mono" style={{ fontSize: '0.8rem' }}>
                    {tag.color}
                  </span>
                </span>
                <span className="muted">Editar</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Sheet
        open={sheetOpen}
        title={draft.id ? 'Editar etiqueta' : 'Nueva etiqueta'}
        onClose={() => setSheetOpen(false)}
        footer={
          draft.id ? (
            <Button variant="destructive" block onClick={() => void handleDelete()} disabled={saving}>
              Eliminar etiqueta
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
          <ColorField
            label="Color"
            value={draft.color}
            onChange={(color) => setDraft((d) => ({ ...d, color }))}
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
