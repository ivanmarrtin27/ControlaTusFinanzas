import { useEffect, useState } from 'react'
import {
  TransactionForm,
  type TransactionSubmitValues,
} from '@/components/money/TransactionForm'
import { Button } from '@/components/ui/Button'
import { ColorField } from '@/components/ui/ColorField'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/contexts/ToastContext'
import { ACCOUNT_TYPE_OPTIONS } from '@/lib/labels'
import {
  createAccount,
  createTransaction,
  MoneyApiError,
} from '@/lib/moneyApi'
import { isOnboardingDone, markOnboardingDone } from '@/lib/onboarding'
import { setTransactionTags } from '@/lib/tagApi'
import { setLastAccountId } from '@/lib/txDefaults'
import type { Account, AccountType, Category, Tag } from '@/types/database'

type Step = 1 | 2 | 3

const STEP_LABELS = ['Crear cuenta', 'Primer gasto', 'Listo'] as const

export interface OnboardingWizardProps {
  userId: string | null
  configured: boolean
  loading: boolean
  accounts: Account[]
  categories: Category[]
  tags: Tag[]
  refresh: () => Promise<void>
}

export function OnboardingWizard({
  userId,
  configured,
  loading,
  accounts,
  categories,
  tags,
  refresh,
}: OnboardingWizardProps) {
  const toast = useToast()

  const [active, setActive] = useState(false)
  const [step, setStep] = useState<Step>(1)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [accountName, setAccountName] = useState('Efectivo')
  const [accountType, setAccountType] = useState<AccountType>('cash')
  const [accountColor, setAccountColor] = useState('#1DB954')
  const [openingBalance, setOpeningBalance] = useState('0')

  useEffect(() => {
    if (!userId || loading || !configured) return
    if (isOnboardingDone(userId)) return

    if (accounts.length === 0) {
      setActive(true)
      setStep(1)
      return
    }

    // Ya tiene datos: no mostrar y no volver a interrumpir.
    markOnboardingDone(userId)
  }, [userId, loading, configured, accounts.length])

  function finish() {
    if (userId) markOnboardingDone(userId)
    setActive(false)
  }

  async function handleCreateAccount() {
    if (!userId) {
      setFormError('Inicia sesión para continuar.')
      return
    }
    const name = accountName.trim()
    if (!name) {
      setFormError('El nombre es obligatorio.')
      return
    }
    const opening = Number(openingBalance.replace(',', '.'))
    if (!Number.isFinite(opening)) {
      setFormError('Saldo inicial no válido.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      const account = await createAccount({
        user_id: userId,
        name,
        type: accountType,
        color: accountColor,
        opening_balance: opening,
        is_active: true,
      })
      setLastAccountId(account.id)
      toast.success('Cuenta creada')
      await refresh()
      setStep(2)
    } catch (err) {
      setFormError(err instanceof MoneyApiError || err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateExpense(values: TransactionSubmitValues) {
    if (!userId) throw new MoneyApiError('Inicia sesión para guardar movimientos.')
    const { tag_ids, ...payload } = values
    const created = await createTransaction({
      user_id: userId,
      type: payload.type,
      amount: payload.amount,
      concept: payload.concept,
      note: payload.note,
      account_id: payload.account_id,
      category_id: payload.category_id,
      occurred_at: payload.occurred_at,
    })
    if (tag_ids.length > 0) {
      await setTransactionTags(userId, created.id, tag_ids)
    }
    toast.success('Gasto registrado')
    await refresh()
    setStep(3)
  }

  if (!active) return null

  return (
    <section className="onboarding-wizard" aria-label="Primeros pasos">
      <div className="onboarding-wizard-head">
        <div>
          <p className="onboarding-wizard-kicker muted">Primeros pasos</p>
          <h2 className="onboarding-wizard-title">{STEP_LABELS[step - 1]}</h2>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={finish}>
          Saltar
        </Button>
      </div>

      <ol className="onboarding-steps" aria-label="Progreso">
        {STEP_LABELS.map((label, index) => {
          const n = (index + 1) as Step
          const state = n < step ? 'done' : n === step ? 'current' : 'todo'
          return (
            <li key={label} className={`onboarding-step onboarding-step-${state}`}>
              <span className="onboarding-step-num" aria-hidden>
                {n}
              </span>
              <span className="onboarding-step-label">{label}</span>
            </li>
          )
        })}
      </ol>

      {step === 1 ? (
        <div className="money-form onboarding-wizard-body">
          <p className="muted onboarding-wizard-lead">
            Una cuenta bancaria o de efectivo para empezar a registrar movimientos.
          </p>
          <Input
            label="Nombre"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            required
            autoComplete="off"
          />
          <Select
            label="Tipo"
            value={accountType}
            onChange={(e) => setAccountType(e.target.value as AccountType)}
            options={ACCOUNT_TYPE_OPTIONS}
          />
          <ColorField label="Color" value={accountColor} onChange={setAccountColor} />
          <Input
            label="Saldo inicial"
            inputMode="decimal"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
          />
          <ErrorBanner message={formError} />
          <div className="form-actions">
            <Button type="button" onClick={() => void handleCreateAccount()} disabled={saving}>
              {saving ? 'Guardando…' : 'Crear y continuar'}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="onboarding-wizard-body">
          <p className="muted onboarding-wizard-lead">
            Registra tu primer gasto. Puedes omitirlo y seguir.
          </p>
          <TransactionForm
            key={accounts.map((a) => a.id).join(',') || 'empty'}
            accounts={accounts}
            categories={categories}
            tags={tags}
            initial={{ type: 'expense' }}
            submitLabel="Guardar gasto"
            cancelLabel="Omitir"
            enableReceipt={false}
            lockType
            onSubmit={handleCreateExpense}
            onCancel={() => setStep(3)}
          />
        </div>
      ) : null}

      {step === 3 ? (
        <div className="onboarding-wizard-body onboarding-wizard-done">
          <p className="onboarding-wizard-lead">
            Listo. Ya puedes ver tu patrimonio en Inicio, añadir más movimientos y explorar el
            resto de la app.
          </p>
          <div className="form-actions">
            <Button type="button" onClick={finish}>
              Ir a Inicio
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
