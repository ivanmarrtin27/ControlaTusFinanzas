import { dayBounds } from '@/lib/balances'
import { buildCalendarEvents, type CalendarEvent } from '@/lib/calendar'
import { formatDateOnly, parseDateOnly, type BudgetProgress } from '@/lib/planning'
import type { Debt, Goal, RecurringRule, Transaction } from '@/types/database'

export type ReminderKind =
  | 'budget'
  | 'recurring'
  | 'calendar'
  | 'inactivity'

export type Reminder = {
  id: string
  kind: ReminderKind
  title: string
  body: string
  href: string
  severity: 'info' | 'warn' | 'danger'
}

const DISMISS_KEY = 'ctf_dismissed_reminders'
const INACTIVITY_DAYS = 7

export function readDismissedReminderIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as string[]
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

export function dismissReminder(id: string): void {
  const set = readDismissedReminderIds()
  set.add(id)
  localStorage.setItem(DISMISS_KEY, JSON.stringify([...set]))
}

export function clearDismissedReminders(): void {
  localStorage.removeItem(DISMISS_KEY)
}

export function buildReminders(params: {
  budgetWarnings: BudgetProgress[]
  recurringRules: RecurringRule[]
  debts: Debt[]
  goals: Goal[]
  transactions: Transaction[]
  now?: Date
}): Reminder[] {
  const now = params.now ?? new Date()
  const reminders: Reminder[] = []
  const horizon = new Date(now)
  horizon.setDate(horizon.getDate() + 7)
  const todayKey = formatDateOnly(now)

  for (const item of params.budgetWarnings) {
    const name = item.category?.name ?? 'Categoría'
    const pct = Math.round(item.ratio * 100)
    reminders.push({
      id: `budget-${item.budget.id}-${item.budget.period_month}`,
      kind: 'budget',
      title: item.overLimit ? `Límite superado: ${name}` : `Límite cerca: ${name}`,
      body: `Has usado el ${pct}% del límite (${item.spent.toFixed(2)} / ${item.limit.toFixed(2)}).`,
      href: '/planificacion',
      severity: item.overLimit ? 'danger' : 'warn',
    })
  }

  for (const rule of params.recurringRules) {
    if (!rule.is_active) continue
    const next = parseDateOnly(rule.next_occurrence)
    const days = Math.ceil((next.getTime() - dayBounds(now).start.getTime()) / 86_400_000)
    if (days < 0 || days > 7) continue
    reminders.push({
      id: `recurring-${rule.id}-${rule.next_occurrence}`,
      kind: 'recurring',
      title: days === 0 ? `Hoy: ${rule.concept}` : `En ${days} días: ${rule.concept}`,
      body: `Recurrente · ${rule.amount.toFixed(2)} · ${rule.next_occurrence}`,
      href: '/planificacion?tab=recurrentes',
      severity: days <= 1 ? 'warn' : 'info',
    })
  }

  const calendarItems = buildCalendarEvents({
    recurringRules: [],
    debts: params.debts,
    goals: params.goals,
    from: dayBounds(now).start,
    to: horizon,
  })
  for (const item of calendarItems) {
    reminders.push(calendarToReminder(item, todayKey))
  }

  if (params.transactions.length === 0) {
    reminders.push({
      id: 'inactivity-empty',
      kind: 'inactivity',
      title: 'Sin movimientos todavía',
      body: 'Registra tu primer ingreso o gasto para empezar el seguimiento.',
      href: '/movimientos?nuevo=1',
      severity: 'info',
    })
  } else {
    const latest = params.transactions.reduce((max, tx) =>
      tx.occurred_at > max ? tx.occurred_at : max,
    params.transactions[0]!.occurred_at)
    const latestDate = new Date(latest)
    const daysIdle = Math.floor(
      (dayBounds(now).start.getTime() - dayBounds(latestDate).start.getTime()) / 86_400_000,
    )
    if (daysIdle >= INACTIVITY_DAYS) {
      reminders.push({
        id: `inactivity-${formatDateOnly(latestDate)}`,
        kind: 'inactivity',
        title: 'Llevas tiempo sin registrar',
        body: `Han pasado ${daysIdle} días desde tu último movimiento. ¿Quieres actualizar el mes?`,
        href: '/movimientos?nuevo=1',
        severity: 'info',
      })
    }
  }

  return reminders
}

function calendarToReminder(item: CalendarEvent, todayKey: string): Reminder {
  const dueLabel =
    item.date === todayKey ? 'Vence hoy' : item.date < todayKey ? 'Vencido' : `Vence ${item.date}`
  return {
    id: `cal-${item.id}`,
    kind: 'calendar',
    title: `${dueLabel}: ${item.title}`,
    body: item.subtitle,
    href: item.href,
    severity: item.date <= todayKey ? 'warn' : 'info',
  }
}

export function filterActiveReminders(
  reminders: Reminder[],
  dismissed: Set<string> = readDismissedReminderIds(),
): Reminder[] {
  return reminders.filter((r) => !dismissed.has(r.id))
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission
  }
  return Notification.requestPermission()
}

export function showBrowserNotifications(reminders: Reminder[]): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  const key = 'ctf_browser_notified'
  let already: Set<string>
  try {
    already = new Set(JSON.parse(localStorage.getItem(key) ?? '[]') as string[])
  } catch {
    already = new Set()
  }
  const next = new Set(already)
  for (const reminder of reminders.slice(0, 3)) {
    if (already.has(reminder.id)) continue
    try {
      new Notification(reminder.title, {
        body: reminder.body,
        tag: reminder.id,
      })
      next.add(reminder.id)
    } catch {
      // ignore
    }
  }
  localStorage.setItem(key, JSON.stringify([...next]))
}
