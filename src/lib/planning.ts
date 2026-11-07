import { monthBounds, roundMoney, toNumber } from '@/lib/balances'
import type {
  Budget,
  Category,
  Goal,
  RecurringFrequency,
  RecurringRule,
  Transaction,
} from '@/types/database'

/** Primer día del mes en formato `YYYY-MM-DD` (columna `budgets.period_month`). */
export function periodMonthKey(reference = new Date()): string {
  const y = reference.getFullYear()
  const m = String(reference.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

export function parseDateOnly(value: string): Date {
  const parts = value.slice(0, 10).split('-').map(Number)
  const y = parts[0] ?? new Date().getFullYear()
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

export function formatDateOnly(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addFrequency(date: Date, frequency: RecurringFrequency): Date {
  const next = new Date(date)
  switch (frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7)
      break
    case 'biweekly':
      next.setDate(next.getDate() + 14)
      break
    case 'monthly':
      next.setMonth(next.getMonth() + 1)
      break
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1)
      break
  }
  return next
}

export interface BudgetProgress {
  budget: Budget
  category: Category | undefined
  spent: number
  limit: number
  remaining: number
  ratio: number
  overLimit: boolean
  nearLimit: boolean
}

/**
 * Gasto del periodo = suma de transacciones `expense` de la categoría
 * cuyo `occurred_at` cae en el mes de `period_month` (día 1 → fin de mes).
 */
export function spentForBudget(
  budget: Pick<Budget, 'category_id' | 'period_month'>,
  transactions: Pick<Transaction, 'category_id' | 'type' | 'amount' | 'occurred_at'>[],
): number {
  const ref = parseDateOnly(budget.period_month)
  const { start, end } = monthBounds(ref)
  let spent = 0
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue
    if (tx.category_id !== budget.category_id) continue
    const at = new Date(tx.occurred_at)
    if (at < start || at >= end) continue
    spent += toNumber(tx.amount)
  }
  return roundMoney(spent)
}

export function buildBudgetProgress(
  budgets: Budget[],
  transactions: Pick<Transaction, 'category_id' | 'type' | 'amount' | 'occurred_at'>[],
  categoriesById: Map<string, Category>,
): BudgetProgress[] {
  return budgets.map((budget) => {
    const spent = spentForBudget(budget, transactions)
    const limit = toNumber(budget.amount_limit)
    const ratio = limit > 0 ? spent / limit : 0
    return {
      budget,
      category: categoriesById.get(budget.category_id),
      spent,
      limit,
      remaining: roundMoney(limit - spent),
      ratio,
      overLimit: spent > limit && limit > 0,
      nearLimit: !!(limit > 0 && ratio >= 0.8 && spent <= limit),
    }
  })
}

export interface RecurringOccurrence {
  ruleId: string
  concept: string
  type: RecurringRule['type']
  amount: number
  date: string
  frequency: RecurringFrequency
  accountId: string | null
  categoryId: string | null
}

/**
 * Genera ocurrencias previstas en los próximos `days` días a partir de
 * `next_occurrence` y la frecuencia (sin job runner; solo cliente).
 */
export function forecastRecurring(
  rules: RecurringRule[],
  days = 30,
  from = new Date(),
): RecurringOccurrence[] {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + days)

  const occurrences: RecurringOccurrence[] = []

  for (const rule of rules) {
    if (!rule.is_active) continue
    let cursor = parseDateOnly(rule.next_occurrence)
    // Si next_occurrence quedó atrás, avanza hasta hoy o más allá
    let guard = 0
    while (cursor < start && guard < 400) {
      cursor = addFrequency(cursor, rule.frequency)
      guard += 1
    }
    guard = 0
    while (cursor < end && guard < 400) {
      if (cursor >= start) {
        occurrences.push({
          ruleId: rule.id,
          concept: rule.concept,
          type: rule.type,
          amount: toNumber(rule.amount),
          date: formatDateOnly(cursor),
          frequency: rule.frequency,
          accountId: rule.account_id,
          categoryId: rule.category_id,
        })
      }
      cursor = addFrequency(cursor, rule.frequency)
      guard += 1
    }
  }

  return occurrences.sort((a, b) => a.date.localeCompare(b.date))
}

export function summarizeForecast(occurrences: RecurringOccurrence[]): {
  income: number
  expense: number
  net: number
  count: number
} {
  let income = 0
  let expense = 0
  for (const item of occurrences) {
    if (item.type === 'income') income += item.amount
    else expense += item.amount
  }
  return {
    income: roundMoney(income),
    expense: roundMoney(expense),
    net: roundMoney(income - expense),
    count: occurrences.length,
  }
}

export function goalProgressRatio(goal: Pick<Goal, 'current_amount' | 'target_amount'>): number {
  const target = toNumber(goal.target_amount)
  if (target <= 0) return 0
  return Math.min(1, toNumber(goal.current_amount) / target)
}

export function resolveGoalStatusAfterContribution(
  currentAmount: number,
  targetAmount: number,
  previousStatus: Goal['status'],
): Goal['status'] {
  if (currentAmount >= targetAmount) return 'completed'
  if (previousStatus === 'completed') return 'active'
  return previousStatus
}
