/**
 * Copia de seguridad JSON (export / import replace).
 *
 * Exporta el snapshot del usuario (cuentas, movimientos, plan, etiquetas, plantillas…).
 * La importación preferida es la RPC atómica `replace_user_backup`; si la migración
 * no está aplicada, cae a deletes+inserts en el cliente (menos seguro ante fallos a medias).
 * Versiones antiguas (v1/v2) se aceptan rellenando arrays que falten.
 */
import { MoneyApiError, loadMoneySnapshot } from '@/lib/moneyApi'
import { loadPlanSnapshot } from '@/lib/planApi'
import { listTags, listTransactionTags } from '@/lib/tagApi'
import { listTemplates } from '@/lib/templateApi'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type {
  Account,
  Budget,
  Category,
  Debt,
  DebtPayment,
  Goal,
  GoalContribution,
  Profile,
  RecurringRule,
  Tag,
  Transaction,
  TransactionTag,
  TransactionTemplate,
  Transfer,
} from '@/types/database'

/** Versión actual del schema JSON. Subir al añadir entidades o romper compatibilidad. */
export const BACKUP_SCHEMA_VERSION = 3 as const

/** v1 sin tags; v2 sin plantillas → arrays vacíos al importar. */
const SUPPORTED_BACKUP_VERSIONS = new Set([1, 2, 3])

export type BackupProfilePrefs = Pick<
  Profile,
  'display_name' | 'accent_color' | 'currency' | 'locale' | 'emergency_fund_target'
>

export type BackupPayload = {
  version: typeof BACKUP_SCHEMA_VERSION
  exported_at: string
  app: 'ControlaTusFinanzas'
  profile: BackupProfilePrefs | null
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  transfers: Transfer[]
  budgets: Budget[]
  recurring_rules: RecurringRule[]
  goals: Goal[]
  goal_contributions: GoalContribution[]
  debts: Debt[]
  debt_payments: DebtPayment[]
  tags: Tag[]
  transaction_tags: TransactionTag[]
  transaction_templates: TransactionTemplate[]
}

type BusinessTable =
  | 'debt_payments'
  | 'goal_contributions'
  | 'transaction_tags'
  | 'transactions'
  | 'transfers'
  | 'budgets'
  | 'recurring_rules'
  | 'goals'
  | 'debts'
  | 'transaction_templates'
  | 'tags'
  | 'accounts'
  | 'categories'

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new MoneyApiError(
      'La copia de seguridad requiere Supabase. Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.',
    )
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asArray<T>(value: unknown, label: string): T[] {
  if (value == null) return []
  if (!Array.isArray(value)) {
    throw new MoneyApiError(`Campo «${label}» inválido: se esperaba un array.`)
  }
  return value as T[]
}

/**
 * Valida un JSON de copia. Acepta v1–v3; campos ausentes → arrays vacíos.
 * Las constraints de fila las aplica Postgres al importar.
 */
export function parseAndValidateBackup(raw: unknown): BackupPayload {
  if (!isRecord(raw)) {
    throw new MoneyApiError('El archivo no es un JSON de copia válido.')
  }

  const version = raw.version
  if (typeof version !== 'number' || !SUPPORTED_BACKUP_VERSIONS.has(version)) {
    throw new MoneyApiError(
      `Versión de copia no soportada (${String(version)}). Esta app acepta versiones 1–${BACKUP_SCHEMA_VERSION}.`,
    )
  }

  const profile = raw.profile == null ? null : (raw.profile as BackupProfilePrefs)

  return {
    version: BACKUP_SCHEMA_VERSION,
    exported_at: typeof raw.exported_at === 'string' ? raw.exported_at : new Date().toISOString(),
    app: 'ControlaTusFinanzas',
    profile,
    accounts: asArray<Account>(raw.accounts, 'accounts'),
    categories: asArray<Category>(raw.categories, 'categories'),
    transactions: asArray<Transaction>(raw.transactions, 'transactions'),
    transfers: asArray<Transfer>(raw.transfers, 'transfers'),
    budgets: asArray<Budget>(raw.budgets, 'budgets'),
    recurring_rules: asArray<RecurringRule>(raw.recurring_rules, 'recurring_rules'),
    goals: asArray<Goal>(raw.goals, 'goals'),
    goal_contributions: asArray<GoalContribution>(raw.goal_contributions, 'goal_contributions'),
    debts: asArray<Debt>(raw.debts, 'debts'),
    debt_payments: asArray<DebtPayment>(raw.debt_payments, 'debt_payments'),
    tags: asArray<Tag>(raw.tags, 'tags'),
    transaction_tags: asArray<TransactionTag>(raw.transaction_tags, 'transaction_tags'),
    transaction_templates: asArray<TransactionTemplate>(
      raw.transaction_templates,
      'transaction_templates',
    ),
  }
}

export async function buildBackupPayload(
  userId: string,
  profile: Profile | null,
): Promise<BackupPayload> {
  ensureConfigured()
  const [money, plan, tags, transactionTags, transactionTemplates] = await Promise.all([
    loadMoneySnapshot(userId),
    loadPlanSnapshot(userId),
    listTags(userId),
    listTransactionTags(userId),
    listTemplates(userId),
  ])

  const profilePrefs: BackupProfilePrefs | null = profile
    ? {
        display_name: profile.display_name,
        accent_color: profile.accent_color,
        currency: profile.currency,
        locale: profile.locale,
        emergency_fund_target: profile.emergency_fund_target,
      }
    : null

  return {
    version: BACKUP_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    app: 'ControlaTusFinanzas',
    profile: profilePrefs,
    accounts: money.accounts,
    categories: money.categories,
    transactions: money.transactions,
    transfers: money.transfers,
    budgets: plan.budgets,
    recurring_rules: plan.recurringRules,
    goals: plan.goals,
    goal_contributions: plan.goalContributions,
    debts: plan.debts,
    debt_payments: plan.debtPayments,
    tags,
    transaction_tags: transactionTags,
    transaction_templates: transactionTemplates,
  }
}

export function downloadBackupJson(payload: BackupPayload): void {
  const stamp = payload.exported_at.slice(0, 10)
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `controlatusfinanzas-backup-${stamp}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function exportUserBackup(userId: string, profile: Profile | null): Promise<BackupPayload> {
  const payload = await buildBackupPayload(userId, profile)
  downloadBackupJson(payload)
  return payload
}

function withCurrentUser<T extends { user_id?: string }>(row: T, userId: string): T & { user_id: string } {
  return { ...row, user_id: userId }
}

async function deleteAllForUser(table: BusinessTable, userId: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('user_id', userId)
  if (error) throw new MoneyApiError(error.message)
}

async function insertChunked(
  table: BusinessTable,
  rows: Record<string, unknown>[],
  chunkSize = 200,
): Promise<void> {
  if (rows.length === 0) return
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    // Typed client expects Insert shapes; backup rows already match table columns.
    const { error } = await supabase.from(table).insert(chunk as never)
    if (error) throw new MoneyApiError(`${table}: ${error.message}`)
  }
}

/**
 * Fallback cliente si falta la RPC. No es atómico: preferir `replace_user_backup`.
 * Orden: hijos/M2M → padres (respetar FKs).
 */
async function replaceBackupClientSide(userId: string, backup: BackupPayload): Promise<void> {
  // Primero hijos / tablas puente (orden FK)
  await deleteAllForUser('debt_payments', userId)
  await deleteAllForUser('goal_contributions', userId)
  await deleteAllForUser('transaction_tags', userId)
  await deleteAllForUser('transactions', userId)
  await deleteAllForUser('transfers', userId)
  await deleteAllForUser('budgets', userId)
  await deleteAllForUser('recurring_rules', userId)
  await deleteAllForUser('goals', userId)
  await deleteAllForUser('debts', userId)
  await deleteAllForUser('tags', userId)
  await deleteAllForUser('transaction_templates', userId)

  // Desbloquear categorías de sistema para que RLS permita borrarlas
  const { error: unlockError } = await supabase
    .from('categories')
    .update({ is_system: false })
    .eq('user_id', userId)
  if (unlockError) throw new MoneyApiError(unlockError.message)

  await deleteAllForUser('accounts', userId)
  await deleteAllForUser('categories', userId)

  await insertChunked(
    'accounts',
    backup.accounts.map((row) => withCurrentUser(row, userId)),
  )
  await insertChunked(
    'categories',
    backup.categories.map((row) => withCurrentUser(row, userId)),
  )
  await insertChunked(
    'tags',
    backup.tags.map((row) => withCurrentUser(row, userId)),
  )
  await insertChunked(
    'transaction_templates',
    backup.transaction_templates.map((row) => withCurrentUser(row, userId)),
  )
  await insertChunked(
    'debts',
    backup.debts.map((row) => withCurrentUser(row, userId)),
  )
  await insertChunked(
    'goals',
    backup.goals.map((row) => withCurrentUser(row, userId)),
  )
  await insertChunked(
    'recurring_rules',
    backup.recurring_rules.map((row) => withCurrentUser(row, userId)),
  )
  await insertChunked(
    'budgets',
    backup.budgets.map((row) => withCurrentUser(row, userId)),
  )
  await insertChunked(
    'transactions',
    backup.transactions.map((row) => withCurrentUser(row, userId)),
  )
  await insertChunked(
    'transfers',
    backup.transfers.map((row) => withCurrentUser(row, userId)),
  )
  await insertChunked(
    'transaction_tags',
    backup.transaction_tags.map((row) => withCurrentUser(row, userId)),
  )
  await insertChunked(
    'goal_contributions',
    backup.goal_contributions.map((row) => withCurrentUser(row, userId)),
  )
  await insertChunked(
    'debt_payments',
    backup.debt_payments.map((row) => withCurrentUser(row, userId)),
  )

  if (backup.profile) {
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: backup.profile.display_name,
        accent_color: backup.profile.accent_color,
        currency: backup.profile.currency,
        locale: backup.profile.locale ?? 'es',
        emergency_fund_target: backup.profile.emergency_fund_target,
      })
      .eq('id', userId)
    if (error) throw new MoneyApiError(error.message)
  }
}

/**
 * Estrategia **replace**: borra filas del usuario para esas entidades e inserta
 * las del backup (IDs preservados, `user_id` forzado al usuario actual).
 * Preferencias de perfil se actualizan in-place (la fila profile no se borra).
 */
export async function importUserBackup(
  userId: string,
  backup: BackupPayload,
): Promise<'rpc' | 'client'> {
  ensureConfigured()

  const rpcPayload = {
    version: backup.version,
    profile: backup.profile,
    accounts: backup.accounts,
    categories: backup.categories,
    transactions: backup.transactions,
    transfers: backup.transfers,
    budgets: backup.budgets,
    recurring_rules: backup.recurring_rules,
    goals: backup.goals,
    goal_contributions: backup.goal_contributions,
    debts: backup.debts,
    debt_payments: backup.debt_payments,
    tags: backup.tags,
    transaction_tags: backup.transaction_tags,
    transaction_templates: backup.transaction_templates,
  }

  const { error } = await supabase.rpc('replace_user_backup', {
    p_payload: rpcPayload,
  })

  if (!error) return 'rpc'

  const msg = error.message.toLowerCase()
  const missingFn =
    (msg.includes('function') && (msg.includes('does not exist') || msg.includes('not found'))) ||
    error.code === 'PGRST202' ||
    error.code === '42883'

  if (!missingFn) {
    throw new MoneyApiError(error.message)
  }

  await replaceBackupClientSide(userId, backup)
  return 'client'
}

export function summarizeBackup(backup: BackupPayload): string {
  return [
    `${backup.accounts.length} cuentas`,
    `${backup.categories.length} categorías`,
    `${backup.transactions.length} movimientos`,
    `${backup.transfers.length} transferencias`,
    `${backup.budgets.length} presupuestos`,
    `${backup.recurring_rules.length} recurrentes`,
    `${backup.goals.length} objetivos`,
    `${backup.goal_contributions.length} aportaciones`,
    `${backup.debts.length} deudas`,
    `${backup.debt_payments.length} pagos de deuda`,
    `${backup.tags.length} etiquetas`,
    `${backup.transaction_tags.length} enlaces etiqueta`,
    `${backup.transaction_templates.length} plantillas`,
  ].join(' · ')
}
