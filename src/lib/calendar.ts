import { formatDateOnly, parseDateOnly } from '@/lib/planning'
import type { Debt, Goal, RecurringRule } from '@/types/database'

export type CalendarKind = 'recurring' | 'debt' | 'goal'

export type CalendarEvent = {
  id: string
  date: string // YYYY-MM-DD
  kind: CalendarKind
  title: string
  subtitle: string
  amount: number | null
  href: string
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Próximas ocurrencias de un recurrente dentro de [from, to] inclusive (fechas). */
export function expandRecurringInRange(
  rule: RecurringRule,
  from: Date,
  to: Date,
): string[] {
  if (!rule.is_active) return []
  const dates: string[] = []
  let cursor = parseDateOnly(rule.next_occurrence)
  // Safety: advance from far past
  let guard = 0
  while (cursor < from && guard < 120) {
    cursor = advanceRecurring(cursor, rule.frequency)
    guard += 1
  }
  guard = 0
  while (cursor <= to && guard < 60) {
    dates.push(formatDateOnly(cursor))
    cursor = advanceRecurring(cursor, rule.frequency)
    guard += 1
  }
  return dates
}

function advanceRecurring(date: Date, frequency: RecurringRule['frequency']): Date {
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

export function buildCalendarEvents(params: {
  recurringRules: RecurringRule[]
  debts: Debt[]
  goals: Goal[]
  from: Date
  to: Date
}): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const fromKey = formatDateOnly(params.from)
  const toKey = formatDateOnly(params.to)

  for (const rule of params.recurringRules) {
    for (const date of expandRecurringInRange(rule, params.from, params.to)) {
      events.push({
        id: `rec-${rule.id}-${date}`,
        date,
        kind: 'recurring',
        title: rule.concept,
        subtitle: rule.type === 'expense' ? 'Recurrente · gasto' : 'Recurrente · ingreso',
        amount: rule.amount,
        href: '/planificacion?tab=recurrentes',
      })
    }
  }

  for (const debt of params.debts) {
    if (debt.status !== 'pending' || !debt.due_date) continue
    if (debt.due_date < fromKey || debt.due_date > toKey) continue
    events.push({
      id: `debt-${debt.id}`,
      date: debt.due_date,
      kind: 'debt',
      title: debt.person_name,
      subtitle: debt.direction === 'owe' ? 'Deuda · debo' : 'Deuda · me deben',
      amount: debt.remaining,
      href: '/planificacion?tab=deudas',
    })
  }

  for (const goal of params.goals) {
    if (!goal.deadline || goal.status === 'completed') continue
    if (goal.deadline < fromKey || goal.deadline > toKey) continue
    events.push({
      id: `goal-${goal.id}`,
      date: goal.deadline,
      kind: 'goal',
      title: goal.name,
      subtitle: 'Objetivo · fecha límite',
      amount: goal.target_amount - goal.current_amount,
      href: '/objetivos',
    })
  }

  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return events
}

export function monthMatrix(reference: Date): { date: Date; inMonth: boolean }[] {
  const year = reference.getFullYear()
  const month = reference.getMonth()
  const first = new Date(year, month, 1)
  const startOffset = first.getDay() === 0 ? 6 : first.getDay() - 1 // lunes = 0
  const gridStart = addDays(first, -startOffset)
  const cells: { date: Date; inMonth: boolean }[] = []
  for (let i = 0; i < 42; i += 1) {
    const date = addDays(gridStart, i)
    cells.push({ date, inMonth: date.getMonth() === month })
  }
  return cells
}

export function eventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>()
  for (const event of events) {
    const list = map.get(event.date) ?? []
    list.push(event)
    map.set(event.date, list)
  }
  return map
}
