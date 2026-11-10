import { monthBounds, roundMoney, toNumber } from '@/lib/balances'
import {
  forecastRecurring,
  formatDateOnly,
  parseDateOnly,
  type RecurringOccurrence,
} from '@/lib/planning'
import type { Category, RecurringRule, Transaction } from '@/types/database'

export type PeriodPreset = 'this_month' | 'last_month' | 'custom'

/** Rango semiabierto [start, end). */
export interface DateRange {
  start: Date
  end: Date
}

export interface PeriodSummary {
  income: number
  expense: number
  balance: number
  count: number
}

export interface CategoryBreakdownRow {
  categoryId: string | null
  name: string
  color: string
  amount: number
  ratio: number
}

export interface CashflowItem {
  id: string
  source: 'recurring' | 'transaction'
  concept: string
  type: 'income' | 'expense'
  amount: number
  date: string
  ruleId?: string
  transactionId?: string
}

export const SAVINGS_RATE_TARGET = 0.2
export const EMERGENCY_MONTHS_TARGET = 3
export const EMERGENCY_MONTHS_STRETCH = 6

export function startOfLocalDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

export function thisMonthRange(reference = new Date()): DateRange {
  return monthBounds(reference)
}

export function lastMonthRange(reference = new Date()): DateRange {
  const prev = new Date(reference.getFullYear(), reference.getMonth() - 1, 1)
  return monthBounds(prev)
}

/** Periodo anterior con la misma duración (días) que `range`. */
export function previousEqualRange(range: DateRange): DateRange {
  const ms = range.end.getTime() - range.start.getTime()
  return {
    start: new Date(range.start.getTime() - ms),
    end: new Date(range.start.getTime()),
  }
}

export function rangeFromDateInputs(from: string, to: string): DateRange | null {
  if (!from || !to) return null
  const start = parseDateOnly(from)
  start.setHours(0, 0, 0, 0)
  const endDay = parseDateOnly(to)
  endDay.setHours(0, 0, 0, 0)
  const end = new Date(endDay)
  end.setDate(end.getDate() + 1)
  if (end <= start) return null
  return { start, end }
}

export function resolvePeriodRange(
  preset: PeriodPreset,
  customFrom: string,
  customTo: string,
  reference = new Date(),
): DateRange {
  if (preset === 'last_month') return lastMonthRange(reference)
  if (preset === 'custom') {
    return rangeFromDateInputs(customFrom, customTo) ?? thisMonthRange(reference)
  }
  return thisMonthRange(reference)
}

export function summarizePeriod(
  transactions: Pick<Transaction, 'type' | 'amount' | 'occurred_at'>[],
  range: DateRange,
): PeriodSummary {
  let income = 0
  let expense = 0
  let count = 0

  for (const tx of transactions) {
    const at = new Date(tx.occurred_at)
    if (at < range.start || at >= range.end) continue
    const amount = toNumber(tx.amount)
    count += 1
    if (tx.type === 'income') income += amount
    else expense += amount
  }

  return {
    income: roundMoney(income),
    expense: roundMoney(expense),
    balance: roundMoney(income - expense),
    count,
  }
}

export function categoryBreakdown(
  transactions: Pick<Transaction, 'type' | 'amount' | 'occurred_at' | 'category_id'>[],
  categoriesById: Map<string, Category>,
  range: DateRange,
  type: 'income' | 'expense',
): CategoryBreakdownRow[] {
  const totals = new Map<string | null, number>()

  for (const tx of transactions) {
    if (tx.type !== type) continue
    const at = new Date(tx.occurred_at)
    if (at < range.start || at >= range.end) continue
    const key = tx.category_id
    totals.set(key, (totals.get(key) ?? 0) + toNumber(tx.amount))
  }

  const rows: CategoryBreakdownRow[] = []
  let max = 0
  for (const [categoryId, amount] of totals) {
    const category = categoryId ? categoriesById.get(categoryId) : undefined
    rows.push({
      categoryId,
      name: category?.name ?? 'Sin categoría',
      color: category?.color ?? '#A7A7A7',
      amount: roundMoney(amount),
      ratio: 0,
    })
    if (amount > max) max = amount
  }

  rows.sort((a, b) => b.amount - a.amount)
  for (const row of rows) {
    row.ratio = max > 0 ? row.amount / max : 0
  }
  return rows
}

export function expenseByCategory(
  transactions: Pick<Transaction, 'type' | 'amount' | 'occurred_at' | 'category_id'>[],
  categoriesById: Map<string, Category>,
  range: DateRange,
): CategoryBreakdownRow[] {
  return categoryBreakdown(transactions, categoriesById, range, 'expense')
}

export function incomeByCategory(
  transactions: Pick<Transaction, 'type' | 'amount' | 'occurred_at' | 'category_id'>[],
  categoriesById: Map<string, Category>,
  range: DateRange,
): CategoryBreakdownRow[] {
  return categoryBreakdown(transactions, categoriesById, range, 'income')
}

/**
 * Tasa de ahorro = (ingresos − gastos) / ingresos.
 * `null` si no hay ingresos en el periodo.
 */
export function savingsRate(income: number, expense: number): number | null {
  if (income <= 0) return null
  return (income - expense) / income
}

/**
 * Media de gasto mensual de los últimos `months` meses naturales
 * anteriores al mes de `reference` (excluye el mes en curso).
 */
export function averageMonthlyExpense(
  transactions: Pick<Transaction, 'type' | 'amount' | 'occurred_at'>[],
  months = 3,
  reference = new Date(),
): number {
  if (months <= 0) return 0
  let total = 0
  let monthsWithData = 0

  for (let i = 1; i <= months; i += 1) {
    const ref = new Date(reference.getFullYear(), reference.getMonth() - i, 1)
    const { start, end } = monthBounds(ref)
    let expense = 0
    let has = false
    for (const tx of transactions) {
      if (tx.type !== 'expense') continue
      const at = new Date(tx.occurred_at)
      if (at < start || at >= end) continue
      expense += toNumber(tx.amount)
      has = true
    }
    if (has) {
      total += expense
      monthsWithData += 1
    }
  }

  if (monthsWithData === 0) {
    // Fallback: gasto del mes en curso (parcial) como proxy
    const current = summarizePeriod(transactions, thisMonthRange(reference))
    return current.expense
  }

  return roundMoney(total / monthsWithData)
}

/**
 * Colchón en meses = patrimonio líquido / media de gasto mensual.
 * `null` si no hay gasto medio.
 */
export function emergencyCushionMonths(
  liquidBalance: number,
  avgMonthlyExpense: number,
): number | null {
  if (avgMonthlyExpense <= 0) return null
  return roundMoney(liquidBalance / avgMonthlyExpense)
}

/** Variación relativa: (actual − anterior) / anterior. `null` si anterior es 0. */
export function relativeChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return (current - previous) / previous
}

export function formatPercent(ratio: number | null, digits = 0): string {
  if (ratio == null || !Number.isFinite(ratio)) return '—'
  return `${(ratio * 100).toFixed(digits)} %`
}

export function formatSignedPercent(ratio: number | null, digits = 0): string {
  if (ratio == null || !Number.isFinite(ratio)) return '—'
  const pct = ratio * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(digits)} %`
}

export function formatMonths(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(digits)} meses`
}

/**
 * Objetivo de fondo de emergencia: valor del perfil o media × meses objetivo.
 */
export function resolveEmergencyTarget(
  profileTarget: number | null | undefined,
  avgMonthlyExpense: number,
  months = EMERGENCY_MONTHS_TARGET,
): number {
  const explicit = toNumber(profileTarget)
  if (explicit > 0) return roundMoney(explicit)
  return roundMoney(avgMonthlyExpense * months)
}

/**
 * Previsión de flujo a `days` días: reglas recurrentes + movimientos futuros
 * ya registrados. Evita doble conteo si el movimiento tiene `recurring_id`
 * en la misma fecha que una ocurrencia prevista.
 */
export function buildCashflowForecast(
  rules: RecurringRule[],
  transactions: Pick<
    Transaction,
    'id' | 'type' | 'amount' | 'concept' | 'occurred_at' | 'recurring_id'
  >[],
  days = 30,
  from = new Date(),
): CashflowItem[] {
  const start = startOfLocalDay(from)
  const end = new Date(start)
  end.setDate(end.getDate() + days)

  const recurring = forecastRecurring(rules, days, from)
  const covered = new Set<string>()

  const items: CashflowItem[] = []

  for (const tx of transactions) {
    const at = new Date(tx.occurred_at)
    if (at < start || at >= end) continue
    const date = formatDateOnly(at)
    items.push({
      id: `tx-${tx.id}`,
      source: 'transaction',
      concept: tx.concept,
      type: tx.type,
      amount: toNumber(tx.amount),
      date,
      transactionId: tx.id,
      ruleId: tx.recurring_id ?? undefined,
    })
    if (tx.recurring_id) {
      covered.add(`${tx.recurring_id}|${date}`)
    }
  }

  for (const occ of recurring) {
    const key = `${occ.ruleId}|${occ.date}`
    if (covered.has(key)) continue
    items.push(occurrenceToCashflow(occ))
  }

  return items.sort((a, b) => a.date.localeCompare(b.date) || a.concept.localeCompare(b.concept))
}

function occurrenceToCashflow(occ: RecurringOccurrence): CashflowItem {
  return {
    id: `rec-${occ.ruleId}-${occ.date}`,
    source: 'recurring',
    concept: occ.concept,
    type: occ.type,
    amount: occ.amount,
    date: occ.date,
    ruleId: occ.ruleId,
  }
}

export function summarizeCashflow(items: CashflowItem[]): {
  income: number
  expense: number
  net: number
  count: number
} {
  let income = 0
  let expense = 0
  for (const item of items) {
    if (item.type === 'income') income += item.amount
    else expense += item.amount
  }
  return {
    income: roundMoney(income),
    expense: roundMoney(expense),
    net: roundMoney(income - expense),
    count: items.length,
  }
}

export type TrendGranularity = 'day' | 'week'

export interface PeriodTrendPoint {
  key: string
  label: string
  income: number
  expense: number
  net: number
  cumulative: number
}

export interface PeriodTrend {
  granularity: TrendGranularity
  points: PeriodTrendPoint[]
}

function rangeDayCount(range: DateRange): number {
  return Math.max(
    1,
    Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000),
  )
}

function startOfLocalWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0)
  const day = d.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + mondayOffset)
  return d
}

function formatTrendLabel(date: Date, granularity: TrendGranularity): string {
  try {
    if (granularity === 'week') {
      return new Intl.DateTimeFormat('es-ES', {
        day: 'numeric',
        month: 'short',
      }).format(date)
    }
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
    }).format(date)
  } catch {
    return formatDateOnly(date)
  }
}

/**
 * Serie temporal del periodo: diaria si ≤45 días, semanal si es más largo.
 * Incluye flujo neto por bucket y balance acumulado desde el inicio del rango.
 */
export function buildPeriodTrend(
  transactions: Pick<Transaction, 'type' | 'amount' | 'occurred_at'>[],
  range: DateRange,
): PeriodTrend {
  const days = rangeDayCount(range)
  const granularity: TrendGranularity = days > 45 ? 'week' : 'day'
  const buckets = new Map<string, { income: number; expense: number; sort: number }>()
  const rangeStartNoon = new Date(
    range.start.getFullYear(),
    range.start.getMonth(),
    range.start.getDate(),
    12,
    0,
    0,
    0,
  )
  const endExclusive = new Date(
    range.end.getFullYear(),
    range.end.getMonth(),
    range.end.getDate(),
    12,
    0,
    0,
    0,
  )

  const cursor = new Date(rangeStartNoon)
  while (cursor < endExclusive) {
    let bucketDate =
      granularity === 'week' ? startOfLocalWeek(cursor) : new Date(cursor)
    if (bucketDate < rangeStartNoon) bucketDate = new Date(rangeStartNoon)
    const key = formatDateOnly(bucketDate)
    if (!buckets.has(key)) {
      buckets.set(key, { income: 0, expense: 0, sort: bucketDate.getTime() })
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  for (const tx of transactions) {
    const at = new Date(tx.occurred_at)
    if (at < range.start || at >= range.end) continue
    const local = new Date(at.getFullYear(), at.getMonth(), at.getDate(), 12, 0, 0, 0)
    let bucketDate = granularity === 'week' ? startOfLocalWeek(local) : local
    if (bucketDate < rangeStartNoon) bucketDate = new Date(rangeStartNoon)
    const key = formatDateOnly(bucketDate)
    const bucket = buckets.get(key)
    if (!bucket) continue
    const amount = toNumber(tx.amount)
    if (tx.type === 'income') bucket.income += amount
    else bucket.expense += amount
  }

  const sorted = [...buckets.entries()].sort((a, b) => a[1].sort - b[1].sort)
  let cumulative = 0
  const points: PeriodTrendPoint[] = sorted.map(([key, bucket]) => {
    const net = roundMoney(bucket.income - bucket.expense)
    cumulative = roundMoney(cumulative + net)
    const date = parseDateOnly(key)
    return {
      key,
      label: formatTrendLabel(date, granularity),
      income: roundMoney(bucket.income),
      expense: roundMoney(bucket.expense),
      net,
      cumulative,
    }
  })

  return { granularity, points }
}

export function comparativeInsight(
  current: PeriodSummary,
  previous: PeriodSummary,
): {
  expenseChange: number | null
  incomeChange: number | null
  balanceDelta: number
  text: string
} {
  const expenseChange = relativeChange(current.expense, previous.expense)
  const incomeChange = relativeChange(current.income, previous.income)
  const balanceDelta = roundMoney(current.balance - previous.balance)

  let text = 'Sin datos suficientes para comparar con el periodo anterior.'

  if (previous.count === 0 && current.count === 0) {
    text = 'Aún no hay movimientos en estos periodos.'
  } else if (previous.count === 0) {
    text = 'Es el primer periodo con datos: no hay comparación previa.'
  } else if (expenseChange != null) {
    if (expenseChange < -0.05) {
      text = `Los gastos bajaron ${formatPercent(Math.abs(expenseChange))} frente al periodo anterior.`
    } else if (expenseChange > 0.05) {
      text = `Los gastos subieron ${formatPercent(expenseChange)} frente al periodo anterior.`
    } else {
      text = 'Los gastos se mantienen en línea con el periodo anterior.'
    }
    if (incomeChange != null && Math.abs(incomeChange) > 0.05) {
      text +=
        incomeChange > 0
          ? ` Los ingresos crecieron ${formatPercent(incomeChange)}.`
          : ` Los ingresos cayeron ${formatPercent(Math.abs(incomeChange))}.`
    }
  }

  return { expenseChange, incomeChange, balanceDelta, text }
}
