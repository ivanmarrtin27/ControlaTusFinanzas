import { toNumber, roundMoney } from '@/lib/balances'
import { dateInputToIso } from '@/lib/dates'
import { MoneyApiError } from '@/lib/moneyApi'
import { resolveGoalStatusAfterContribution } from '@/lib/planning'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type {
  Budget,
  Database,
  Debt,
  DebtPayment,
  Goal,
  GoalContribution,
  RecurringRule,
  Transaction,
} from '@/types/database'

type BudgetInsert = Database['public']['Tables']['budgets']['Insert']
type BudgetUpdate = Database['public']['Tables']['budgets']['Update']
type RecurringInsert = Database['public']['Tables']['recurring_rules']['Insert']
type RecurringUpdate = Database['public']['Tables']['recurring_rules']['Update']
type GoalInsert = Database['public']['Tables']['goals']['Insert']
type GoalUpdate = Database['public']['Tables']['goals']['Update']
type DebtInsert = Database['public']['Tables']['debts']['Insert']
type DebtUpdate = Database['public']['Tables']['debts']['Update']

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new MoneyApiError(
      'Supabase no está configurado. Añade VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.',
    )
  }
}

function throwFromError(error: { message: string } | null): never {
  throw new MoneyApiError(error?.message ?? 'Error desconocido de Supabase')
}

function mapBudget(row: Budget): Budget {
  return { ...row, amount_limit: toNumber(row.amount_limit) }
}

function mapRecurring(row: RecurringRule): RecurringRule {
  return { ...row, amount: toNumber(row.amount) }
}

function mapGoal(row: Goal): Goal {
  return {
    ...row,
    target_amount: toNumber(row.target_amount),
    current_amount: toNumber(row.current_amount),
    deadline: row.deadline ?? null,
  }
}

function mapContribution(row: GoalContribution): GoalContribution {
  return { ...row, amount: toNumber(row.amount) }
}

function mapDebt(row: Debt): Debt {
  return {
    ...row,
    principal: toNumber(row.principal),
    remaining: toNumber(row.remaining),
    due_date: row.due_date ?? null,
  }
}

function mapDebtPayment(row: DebtPayment): DebtPayment {
  return { ...row, amount: toNumber(row.amount) }
}

// —— Budgets ————————————————————————————————————————————————

export async function listBudgets(userId: string, periodMonth?: string): Promise<Budget[]> {
  ensureConfigured()
  let query = supabase.from('budgets').select('*').eq('user_id', userId)
  if (periodMonth) query = query.eq('period_month', periodMonth)
  const { data, error } = await query.order('created_at', { ascending: true })
  if (error) throwFromError(error)
  return ((data as Budget[]) ?? []).map(mapBudget)
}

export async function createBudget(payload: BudgetInsert): Promise<Budget> {
  ensureConfigured()
  const { data, error } = await supabase.from('budgets').insert(payload).select('*').single()
  if (error) throwFromError(error)
  return mapBudget(data as Budget)
}

export async function updateBudget(id: string, payload: BudgetUpdate): Promise<Budget> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('budgets')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throwFromError(error)
  return mapBudget(data as Budget)
}

export async function deleteBudget(id: string): Promise<void> {
  ensureConfigured()
  const { error } = await supabase.from('budgets').delete().eq('id', id)
  if (error) throwFromError(error)
}

// —— Recurring rules ————————————————————————————————————————

export async function listRecurringRules(userId: string): Promise<RecurringRule[]> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('recurring_rules')
    .select('*')
    .eq('user_id', userId)
    .order('next_occurrence', { ascending: true })
  if (error) throwFromError(error)
  return ((data as RecurringRule[]) ?? []).map(mapRecurring)
}

export async function createRecurringRule(payload: RecurringInsert): Promise<RecurringRule> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('recurring_rules')
    .insert(payload)
    .select('*')
    .single()
  if (error) throwFromError(error)
  return mapRecurring(data as RecurringRule)
}

export async function updateRecurringRule(
  id: string,
  payload: RecurringUpdate,
): Promise<RecurringRule> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('recurring_rules')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throwFromError(error)
  return mapRecurring(data as RecurringRule)
}

export async function deleteRecurringRule(id: string): Promise<void> {
  ensureConfigured()
  const { error } = await supabase.from('recurring_rules').delete().eq('id', id)
  if (error) throwFromError(error)
}

// —— Goals + contributions ——————————————————————————————————

export async function listGoals(userId: string): Promise<Goal[]> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throwFromError(error)
  return ((data as Goal[]) ?? []).map(mapGoal)
}

export async function createGoal(payload: GoalInsert): Promise<Goal> {
  ensureConfigured()
  const { data, error } = await supabase.from('goals').insert(payload).select('*').single()
  if (error) throwFromError(error)
  return mapGoal(data as Goal)
}

export async function updateGoal(id: string, payload: GoalUpdate): Promise<Goal> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('goals')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throwFromError(error)
  return mapGoal(data as Goal)
}

export async function deleteGoal(id: string): Promise<void> {
  ensureConfigured()
  const { error } = await supabase.from('goals').delete().eq('id', id)
  if (error) throwFromError(error)
}

export async function listGoalContributions(
  userId: string,
  goalId?: string,
): Promise<GoalContribution[]> {
  ensureConfigured()
  let query = supabase.from('goal_contributions').select('*').eq('user_id', userId)
  if (goalId) query = query.eq('goal_id', goalId)
  const { data, error } = await query.order('occurred_at', { ascending: false })
  if (error) throwFromError(error)
  return ((data as GoalContribution[]) ?? []).map(mapContribution)
}

export interface ContributeToGoalParams {
  userId: string
  goal: Goal
  accountId: string
  amount: number
  occurredAt: string
  /** Si true, crea un gasto en la cuenta y lo vincula. */
  createTransaction?: boolean
}

export async function contributeToGoal(
  params: ContributeToGoalParams,
): Promise<{ goal: Goal; contribution: GoalContribution; transaction: Transaction | null }> {
  ensureConfigured()
  const amount = roundMoney(params.amount)
  if (!(amount > 0)) throw new MoneyApiError('La aportación debe ser mayor que 0.')

  let transactionId: string | null = null
  let transaction: Transaction | null = null

  if (params.createTransaction) {
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: params.userId,
        account_id: params.accountId,
        category_id: null,
        type: 'expense' as const,
        amount,
        concept: `Aportación · ${params.goal.name}`,
        note: 'Aportación a objetivo de ahorro',
        occurred_at: dateInputToIso(params.occurredAt.slice(0, 10)),
      })
      .select('*')
      .single()
    if (txError) throwFromError(txError)
    transaction = {
      ...(txData as Transaction),
      amount: toNumber((txData as Transaction).amount),
    }
    transactionId = transaction.id
  }

  const { data: contribData, error: contribError } = await supabase
    .from('goal_contributions')
    .insert({
      user_id: params.userId,
      goal_id: params.goal.id,
      account_id: params.accountId,
      amount,
      occurred_at: dateInputToIso(params.occurredAt.slice(0, 10)),
      transaction_id: transactionId,
    })
    .select('*')
    .single()
  if (contribError) throwFromError(contribError)

  const nextCurrent = roundMoney(toNumber(params.goal.current_amount) + amount)
  const nextStatus = resolveGoalStatusAfterContribution(
    nextCurrent,
    toNumber(params.goal.target_amount),
    params.goal.status,
  )

  const { data: goalData, error: goalError } = await supabase
    .from('goals')
    .update({ current_amount: nextCurrent, status: nextStatus })
    .eq('id', params.goal.id)
    .select('*')
    .single()
  if (goalError) throwFromError(goalError)

  return {
    goal: mapGoal(goalData as Goal),
    contribution: mapContribution(contribData as GoalContribution),
    transaction,
  }
}

// —— Debts + payments ——————————————————————————————————————

export async function listDebts(userId: string): Promise<Debt[]> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throwFromError(error)
  return ((data as Debt[]) ?? []).map(mapDebt)
}

export async function createDebt(payload: DebtInsert): Promise<Debt> {
  ensureConfigured()
  const { data, error } = await supabase.from('debts').insert(payload).select('*').single()
  if (error) throwFromError(error)
  return mapDebt(data as Debt)
}

export async function updateDebt(id: string, payload: DebtUpdate): Promise<Debt> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('debts')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throwFromError(error)
  return mapDebt(data as Debt)
}

export async function deleteDebt(id: string): Promise<void> {
  ensureConfigured()
  const { error } = await supabase.from('debts').delete().eq('id', id)
  if (error) throwFromError(error)
}

export async function listDebtPayments(userId: string, debtId?: string): Promise<DebtPayment[]> {
  ensureConfigured()
  let query = supabase.from('debt_payments').select('*').eq('user_id', userId)
  if (debtId) query = query.eq('debt_id', debtId)
  const { data, error } = await query.order('occurred_at', { ascending: false })
  if (error) throwFromError(error)
  return ((data as DebtPayment[]) ?? []).map(mapDebtPayment)
}

export interface RecordDebtPaymentParams {
  userId: string
  debt: Debt
  amount: number
  occurredAt: string
  accountId?: string
  /** Si true y hay accountId, crea ingreso/gasto vinculado. */
  createTransaction?: boolean
}

export async function recordDebtPayment(
  params: RecordDebtPaymentParams,
): Promise<{ debt: Debt; payment: DebtPayment; transaction: Transaction | null }> {
  ensureConfigured()
  const amount = roundMoney(params.amount)
  if (!(amount > 0)) throw new MoneyApiError('El pago debe ser mayor que 0.')
  if (amount > toNumber(params.debt.remaining) + 0.001) {
    throw new MoneyApiError('El pago no puede superar el pendiente.')
  }

  let transactionId: string | null = null
  let transaction: Transaction | null = null

  if (params.createTransaction && params.accountId) {
    const txType = params.debt.direction === 'owe' ? 'expense' : 'income'
    const label = params.debt.direction === 'owe' ? 'Pago de deuda' : 'Cobro de deuda'
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: params.userId,
        account_id: params.accountId,
        category_id: null,
        type: txType,
        amount,
        concept: `${label} · ${params.debt.person_name}`,
        note: 'Pago registrado desde Planificación',
        occurred_at: dateInputToIso(params.occurredAt.slice(0, 10)),
        debt_id: params.debt.id,
      })
      .select('*')
      .single()
    if (txError) throwFromError(txError)
    transaction = {
      ...(txData as Transaction),
      amount: toNumber((txData as Transaction).amount),
    }
    transactionId = transaction.id
  }

  const { data: paymentData, error: paymentError } = await supabase
    .from('debt_payments')
    .insert({
      user_id: params.userId,
      debt_id: params.debt.id,
      amount,
      occurred_at: dateInputToIso(params.occurredAt.slice(0, 10)),
      transaction_id: transactionId,
    })
    .select('*')
    .single()
  if (paymentError) throwFromError(paymentError)

  const nextRemaining = roundMoney(Math.max(0, toNumber(params.debt.remaining) - amount))
  const nextStatus = nextRemaining <= 0 ? 'settled' : 'pending'

  const { data: debtData, error: debtError } = await supabase
    .from('debts')
    .update({ remaining: nextRemaining, status: nextStatus })
    .eq('id', params.debt.id)
    .select('*')
    .single()
  if (debtError) throwFromError(debtError)

  return {
    debt: mapDebt(debtData as Debt),
    payment: mapDebtPayment(paymentData as DebtPayment),
    transaction,
  }
}

// —— Snapshot ——————————————————————————————————————————————

export interface PlanSnapshot {
  budgets: Budget[]
  recurringRules: RecurringRule[]
  goals: Goal[]
  goalContributions: GoalContribution[]
  debts: Debt[]
  debtPayments: DebtPayment[]
}

export async function loadPlanSnapshot(userId: string): Promise<PlanSnapshot> {
  ensureConfigured()
  const [budgets, recurringRules, goals, goalContributions, debts, debtPayments] =
    await Promise.all([
      listBudgets(userId),
      listRecurringRules(userId),
      listGoals(userId),
      listGoalContributions(userId),
      listDebts(userId),
      listDebtPayments(userId),
    ])
  return { budgets, recurringRules, goals, goalContributions, debts, debtPayments }
}
