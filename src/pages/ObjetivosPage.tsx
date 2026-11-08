import { useMemo, useState } from 'react'
import { ProgressBar } from '@/components/plan/ProgressBar'
import { ConfigBanner } from '@/components/money/ConfigBanner'
import { Button } from '@/components/ui/Button'
import { ColorField } from '@/components/ui/ColorField'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Sheet } from '@/components/ui/Sheet'
import { MoneyListSkeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { usePlanData } from '@/hooks/usePlanData'
import { formatMoney } from '@/lib/currency'
import { formatShortDate, toDateInputValue } from '@/lib/dates'
import { GOAL_STATUS_LABELS } from '@/lib/labels'
import { MoneyApiError } from '@/lib/moneyApi'
import {
  contributeToGoal,
  createGoal,
  deleteGoal,
  updateGoal,
} from '@/lib/planApi'
import { goalProgressRatio } from '@/lib/planning'
import type { Goal, GoalStatus } from '@/types/database'

type Mode = 'edit' | 'contribute'

type Draft = {
  id?: string
  name: string
  target_amount: string
  current_amount: string
  status: GoalStatus
  color: string
  deadline: string
}

type ContributeDraft = {
  goalId: string
  amount: string
  account_id: string
  occurred_at: string
  createTransaction: boolean
}

const emptyDraft = (): Draft => ({
  name: '',
  target_amount: '',
  current_amount: '0',
  status: 'active',
  color: '#1DB954',
  deadline: '',
})

export function ObjetivosPage() {
  const { profile } = useAuth()
  const currency = profile?.currency ?? 'EUR'
  const plan = usePlanData()
  const toast = useToast()

  const [statusTab, setStatusTab] = useState<GoalStatus | 'all'>('active')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('edit')
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [contrib, setContrib] = useState<ContributeDraft | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const visible = useMemo(() => {
    if (statusTab === 'all') return plan.goals
    return plan.goals.filter((g) => g.status === statusTab)
  }, [plan.goals, statusTab])

  const accountOptions = useMemo(
    () => plan.activeAccounts.map((a) => ({ value: a.id, label: a.name })),
    [plan.activeAccounts],
  )

  function openCreate() {
    setMode('edit')
    setDraft(emptyDraft())
    setContrib(null)
    setFormError(null)
    setSheetOpen(true)
  }

  function openEdit(goal: Goal) {
    setMode('edit')
    setDraft({
      id: goal.id,
      name: goal.name,
      target_amount: String(goal.target_amount),
      current_amount: String(goal.current_amount),
      status: goal.status,
      color: goal.color,
      deadline: goal.deadline?.slice(0, 10) ?? '',
    })
    setContrib(null)
    setFormError(null)
    setSheetOpen(true)
  }

  function openContribute(goal: Goal) {
    setMode('contribute')
    setDraft({
      id: goal.id,
      name: goal.name,
      target_amount: String(goal.target_amount),
      current_amount: String(goal.current_amount),
      status: goal.status,
      color: goal.color,
      deadline: goal.deadline?.slice(0, 10) ?? '',
    })
    setContrib({
      goalId: goal.id,
      amount: '',
      account_id: accountOptions[0]?.value ?? '',
      occurred_at: toDateInputValue(),
      createTransaction: Boolean(accountOptions[0]),
    })
    setFormError(null)
    setSheetOpen(true)
  }

  async function handleSaveGoal() {
    if (!plan.userId) {
      setFormError('Inicia sesión para guardar objetivos.')
      return
    }
    const name = draft.name.trim()
    if (!name) {
      setFormError('El nombre es obligatorio.')
      return
    }
    const target = Number(draft.target_amount.replace(',', '.'))
    const current = Number(draft.current_amount.replace(',', '.'))
    if (!Number.isFinite(target) || target <= 0) {
      setFormError('La meta debe ser mayor que 0.')
      return
    }
    if (!Number.isFinite(current) || current < 0) {
      setFormError('El progreso actual no es válido.')
      return
    }

    setSaving(true)
    setFormError(null)
    const wasEdit = Boolean(draft.id)
    try {
      let status = draft.status
      if (current >= target) status = 'completed'
      else if (status === 'completed') status = 'active'

      const payload = {
        name,
        target_amount: target,
        current_amount: current,
        status,
        color: draft.color,
        deadline: draft.deadline || null,
      }
      if (draft.id) {
        await updateGoal(draft.id, payload)
      } else {
        await createGoal({ user_id: plan.userId, ...payload })
      }
      setSheetOpen(false)
      toast.success(wasEdit ? 'Objetivo actualizado' : 'Objetivo creado')
      await plan.refresh()
    } catch (err) {
      setFormError(err instanceof MoneyApiError || err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function handleContribute() {
    if (!plan.userId || !contrib || !draft.id) return
    const goal = plan.goals.find((g) => g.id === draft.id)
    if (!goal) return
    const amount = Number(contrib.amount.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Importe no válido.')
      return
    }
    if (!contrib.account_id) {
      setFormError('Elige una cuenta.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      await contributeToGoal({
        userId: plan.userId,
        goal,
        accountId: contrib.account_id,
        amount,
        occurredAt: contrib.occurred_at,
        createTransaction: contrib.createTransaction,
      })
      setSheetOpen(false)
      toast.success('Aportación guardada')
      await plan.refresh()
    } catch (err) {
      setFormError(err instanceof MoneyApiError || err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!draft.id) return
    if (!window.confirm('¿Eliminar este objetivo y sus aportaciones?')) return
    setSaving(true)
    setFormError(null)
    try {
      await deleteGoal(draft.id)
      setSheetOpen(false)
      toast.success('Objetivo eliminado')
      await plan.refresh()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo eliminar.')
    } finally {
      setSaving(false)
    }
  }

  async function togglePause(goal: Goal) {
    const next = goal.status === 'paused' ? 'active' : 'paused'
    await updateGoal(goal.id, { status: next })
    toast.success(next === 'paused' ? 'Objetivo pausado' : 'Objetivo reanudado')
    await plan.refresh()
  }

  return (
    <main className="page">
      <header className="page-header page-header-row">
        <div>
          <h1>Objetivos</h1>
          <p className="page-header-lead">Metas de ahorro y aportaciones.</p>
        </div>
        <Button onClick={openCreate} disabled={!plan.configured || !plan.userId}>
          Nuevo
        </Button>
      </header>

      <div className="stack-md">
        <ConfigBanner configured={plan.configured} error={plan.error} />

        <div className="chip-row">
          {(
            [
              ['active', 'Activos'],
              ['paused', 'Pausados'],
              ['completed', 'Conseguidos'],
              ['all', 'Todos'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`chip${statusTab === value ? ' chip-active' : ''}`}
              onClick={() => {
                setStatusTab(value)
                window.scrollTo(0, 0)
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div key={statusTab} className="subsection-enter">
          {plan.loading ? (
            <MoneyListSkeleton rows={4} />
          ) : visible.length === 0 ? (
            <EmptyState
              title="Sin objetivos"
              description="Crea una meta (viaje, colchón, entrada…) y aporta desde una cuenta."
              action={
                <Button onClick={openCreate} disabled={!plan.configured || !plan.userId}>
                  Crear objetivo
                </Button>
              }
            />
          ) : (
            <div className="money-list">
              {visible.map((goal) => {
                const ratio = goalProgressRatio(goal)
                const tone =
                  goal.status === 'completed' ? 'success' : goal.status === 'paused' ? 'warn' : 'accent'
                return (
                  <div key={goal.id} className="money-row money-row-stack money-row-static">
                    <span className="money-dot" style={{ background: goal.color }} />
                    <span className="money-row-main">
                      <button type="button" className="linkish" onClick={() => openEdit(goal)}>
                        <strong>{goal.name}</strong>
                      </button>
                      <span className="muted">
                        {GOAL_STATUS_LABELS[goal.status]}
                        {goal.deadline ? ` · hasta ${formatShortDate(goal.deadline)}` : ''}
                      </span>
                      <ProgressBar
                        ratio={ratio}
                        tone={tone}
                        label={`${formatMoney(goal.current_amount, currency)} / ${formatMoney(goal.target_amount, currency)}`}
                      />
                      {goal.status !== 'completed' ? (
                        <div className="row-actions">
                          <Button size="sm" variant="secondary" onClick={() => openContribute(goal)}>
                            Aportar
                          </Button>
                          {goal.status === 'active' || goal.status === 'paused' ? (
                            <Button size="sm" variant="ghost" onClick={() => void togglePause(goal)}>
                              {goal.status === 'paused' ? 'Reanudar' : 'Pausar'}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </span>
                    <span className="amount">{Math.round(ratio * 100)}%</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <Sheet
        open={sheetOpen}
        title={
          mode === 'contribute'
            ? `Aportar · ${draft.name}`
            : draft.id
              ? 'Editar objetivo'
              : 'Nuevo objetivo'
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
              onClick={() => void (mode === 'contribute' ? handleContribute() : handleSaveGoal())}
              disabled={saving}
            >
              {saving ? 'Guardando…' : mode === 'contribute' ? 'Aportar' : 'Guardar'}
            </Button>
          </div>
        }
      >
        <div className="money-form">
          <ErrorBanner message={formError} />

          {mode === 'contribute' && contrib ? (
            <>
              <p className="muted" style={{ margin: 0 }}>
                Progreso: {formatMoney(Number(draft.current_amount) || 0, currency)} de{' '}
                {formatMoney(Number(draft.target_amount) || 0, currency)}
              </p>
              <Input
                label="Importe"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={contrib.amount}
                onChange={(e) => setContrib((c) => (c ? { ...c, amount: e.target.value } : c))}
              />
              <Select
                label="Desde la cuenta"
                value={contrib.account_id}
                onChange={(e) => setContrib((c) => (c ? { ...c, account_id: e.target.value } : c))}
                options={accountOptions}
                placeholder="Elige cuenta"
              />
              <Input
                label="Fecha"
                type="date"
                value={contrib.occurred_at}
                onChange={(e) =>
                  setContrib((c) => (c ? { ...c, occurred_at: e.target.value } : c))
                }
              />
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={contrib.createTransaction}
                  onChange={(e) =>
                    setContrib((c) => (c ? { ...c, createTransaction: e.target.checked } : c))
                  }
                />
                Restar el importe de la cuenta (crear gasto)
              </label>
            </>
          ) : (
            <>
              <Input
                label="Nombre"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
              <Input
                label="Meta"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={draft.target_amount}
                onChange={(e) => setDraft((d) => ({ ...d, target_amount: e.target.value }))}
              />
              <Input
                label="Ahorrado ahora"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={draft.current_amount}
                onChange={(e) => setDraft((d) => ({ ...d, current_amount: e.target.value }))}
                hint="También puedes usar el botón Aportar desde la lista."
              />
              <Input
                label="Fecha límite (opcional)"
                type="date"
                value={draft.deadline}
                onChange={(e) => setDraft((d) => ({ ...d, deadline: e.target.value }))}
              />
              <ColorField
                label="Color"
                value={draft.color}
                onChange={(color) => setDraft((d) => ({ ...d, color }))}
              />
              <Select
                label="Estado"
                value={draft.status}
                onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as GoalStatus }))}
                options={[
                  { value: 'active', label: GOAL_STATUS_LABELS.active },
                  { value: 'paused', label: GOAL_STATUS_LABELS.paused },
                  { value: 'completed', label: GOAL_STATUS_LABELS.completed },
                ]}
              />
              {draft.id && draft.status !== 'completed' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const goal = plan.goals.find((g) => g.id === draft.id)
                    if (goal) openContribute(goal)
                  }}
                >
                  Aportar dinero…
                </Button>
              ) : null}
            </>
          )}
        </div>
      </Sheet>
    </main>
  )
}
