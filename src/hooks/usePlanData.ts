import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMoneyData } from '@/hooks/useMoneyData'
import { useVisibilityRefresh } from '@/hooks/useVisibilityRefresh'
import { MoneyApiError } from '@/lib/moneyApi'
import { loadPlanSnapshot, type PlanSnapshot } from '@/lib/planApi'
import {
  buildBudgetProgress,
  forecastRecurring,
  periodMonthKey,
  summarizeForecast,
} from '@/lib/planning'
import { writeLastSyncedAt } from '@/lib/syncMeta'
import type {
  Budget,
  Debt,
  DebtPayment,
  Goal,
  GoalContribution,
  RecurringRule,
} from '@/types/database'

const EMPTY_PLAN: PlanSnapshot = {
  budgets: [],
  recurringRules: [],
  goals: [],
  goalContributions: [],
  debts: [],
  debtPayments: [],
}

export function usePlanData() {
  const money = useMoneyData()
  const [plan, setPlan] = useState<PlanSnapshot>(EMPTY_PLAN)
  const [planLoading, setPlanLoading] = useState(money.configured && Boolean(money.userId))
  const [planError, setPlanError] = useState<string | null>(null)

  const refreshPlan = useCallback(async () => {
    if (!money.configured) {
      setPlan(EMPTY_PLAN)
      setPlanError('Configura Supabase en .env para sincronizar tus datos.')
      setPlanLoading(false)
      return
    }
    if (!money.userId) {
      setPlan(EMPTY_PLAN)
      setPlanError(null)
      setPlanLoading(false)
      return
    }

    setPlanLoading(true)
    setPlanError(null)
    try {
      const snapshot = await loadPlanSnapshot(money.userId)
      setPlan(snapshot)
      writeLastSyncedAt()
    } catch (err) {
      const message =
        err instanceof MoneyApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudieron cargar los datos de planificación.'
      setPlanError(message)
      setPlan(EMPTY_PLAN)
    } finally {
      setPlanLoading(false)
    }
  }, [money.configured, money.userId])

  useEffect(() => {
    void refreshPlan()
  }, [refreshPlan])

  const refreshMoney = money.refresh

  const refresh = useCallback(async () => {
    await Promise.all([refreshMoney(), refreshPlan()])
  }, [refreshMoney, refreshPlan])

  useVisibilityRefresh(refreshPlan, money.configured && Boolean(money.userId))

  const currentPeriod = periodMonthKey()

  const budgetsThisMonth = useMemo(
    () => plan.budgets.filter((b) => b.period_month === currentPeriod),
    [plan.budgets, currentPeriod],
  )

  const budgetProgress = useMemo(
    () => buildBudgetProgress(budgetsThisMonth, money.transactions, money.categoriesById),
    [budgetsThisMonth, money.transactions, money.categoriesById],
  )

  const budgetWarnings = useMemo(
    () => budgetProgress.filter((b) => b.overLimit || b.nearLimit),
    [budgetProgress],
  )

  const activeRecurring = useMemo(
    () => plan.recurringRules.filter((r) => r.is_active),
    [plan.recurringRules],
  )

  const forecast30 = useMemo(() => forecastRecurring(activeRecurring, 30), [activeRecurring])

  const forecastSummary = useMemo(() => summarizeForecast(forecast30), [forecast30])

  const activeGoals = useMemo(
    () => plan.goals.filter((g) => g.status === 'active'),
    [plan.goals],
  )

  const pendingDebts = useMemo(
    () => plan.debts.filter((d) => d.status === 'pending'),
    [plan.debts],
  )

  const error = money.error ?? planError
  const loading = money.loading || planLoading

  return {
    ...money,
    budgets: plan.budgets,
    recurringRules: plan.recurringRules,
    goals: plan.goals,
    goalContributions: plan.goalContributions,
    debts: plan.debts,
    debtPayments: plan.debtPayments,
    budgetsThisMonth,
    budgetProgress,
    budgetWarnings,
    currentPeriod,
    activeRecurring,
    forecast30,
    forecastSummary,
    activeGoals,
    pendingDebts,
    loading,
    error,
    planError,
    lastSyncedAt: money.lastSyncedAt,
    refresh,
    refreshPlan,
    setLocalBudgets: (budgets: Budget[]) => setPlan((prev) => ({ ...prev, budgets })),
    setLocalRecurring: (recurringRules: RecurringRule[]) =>
      setPlan((prev) => ({ ...prev, recurringRules })),
    setLocalGoals: (goals: Goal[]) => setPlan((prev) => ({ ...prev, goals })),
    setLocalContributions: (goalContributions: GoalContribution[]) =>
      setPlan((prev) => ({ ...prev, goalContributions })),
    setLocalDebts: (debts: Debt[]) => setPlan((prev) => ({ ...prev, debts })),
    setLocalDebtPayments: (debtPayments: DebtPayment[]) =>
      setPlan((prev) => ({ ...prev, debtPayments })),
  }
}
