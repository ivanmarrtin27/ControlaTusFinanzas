import type {
  AccountType,
  CategoryKind,
  DebtDirection,
  DebtStatus,
  GoalStatus,
  RecurringFrequency,
  TransactionType,
} from '@/types/database'

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: 'Bancaria',
  cash: 'Efectivo',
  card: 'Tarjeta',
  other: 'Otra',
}

export const ACCOUNT_TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: 'bank', label: ACCOUNT_TYPE_LABELS.bank },
  { value: 'cash', label: ACCOUNT_TYPE_LABELS.cash },
  { value: 'card', label: ACCOUNT_TYPE_LABELS.card },
  { value: 'other', label: ACCOUNT_TYPE_LABELS.other },
]

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  expense: 'Gasto',
  income: 'Ingreso',
}

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  expense: 'Gasto',
  income: 'Ingreso',
}

export const RECURRING_FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
  yearly: 'Anual',
}

export const RECURRING_FREQUENCY_OPTIONS: {
  value: RecurringFrequency
  label: string
}[] = [
  { value: 'weekly', label: RECURRING_FREQUENCY_LABELS.weekly },
  { value: 'biweekly', label: RECURRING_FREQUENCY_LABELS.biweekly },
  { value: 'monthly', label: RECURRING_FREQUENCY_LABELS.monthly },
  { value: 'yearly', label: RECURRING_FREQUENCY_LABELS.yearly },
]

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  active: 'Activo',
  paused: 'Pausado',
  completed: 'Conseguido',
}

export const DEBT_DIRECTION_LABELS: Record<DebtDirection, string> = {
  owe: 'Debo',
  owed: 'Me deben',
}

export const DEBT_STATUS_LABELS: Record<DebtStatus, string> = {
  pending: 'Pendiente',
  settled: 'Saldada',
}

export const ACCOUNT_COLOR_PRESETS = [
  '#1DB954',
  '#0E7490',
  '#7C3AED',
  '#C2410C',
  '#B45309',
  '#059669',
  '#64748B',
  '#E11D48',
] as const
