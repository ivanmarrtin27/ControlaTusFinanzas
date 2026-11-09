import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { roundMoney, toNumber } from '@/lib/balances'
import type {
  Account,
  Category,
  Database,
  Transaction,
  TransactionType,
  Transfer,
} from '@/types/database'

type AccountInsert = Database['public']['Tables']['accounts']['Insert']
type AccountUpdate = Database['public']['Tables']['accounts']['Update']
type CategoryInsert = Database['public']['Tables']['categories']['Insert']
type CategoryUpdate = Database['public']['Tables']['categories']['Update']
type TransactionInsert = Database['public']['Tables']['transactions']['Insert']
type TransactionUpdate = Database['public']['Tables']['transactions']['Update']
type TransferInsert = Database['public']['Tables']['transfers']['Insert']
type TransferUpdate = Database['public']['Tables']['transfers']['Update']

export class MoneyApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MoneyApiError'
  }
}

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new MoneyApiError(
      'Supabase no está configurado. Añade VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.',
    )
  }
}

function mapAccount(row: Account): Account {
  return { ...row, opening_balance: toNumber(row.opening_balance) }
}

function mapTransaction(row: Transaction): Transaction {
  return { ...row, amount: toNumber(row.amount) }
}

function mapTransfer(row: Transfer): Transfer {
  return { ...row, amount: toNumber(row.amount) }
}

export function humanizeSupabaseError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('row-level security') || m.includes('violates row-level security')) {
    return 'No tienes permiso para guardar. Cierra sesión y vuelve a entrar.'
  }
  if (m.includes('jwt') || m.includes('not authenticated') || m.includes('unauthorized')) {
    return 'Tu sesión ha caducado. Vuelve a iniciar sesión.'
  }
  if (m.includes('foreign key') && m.includes('account')) {
    return 'La cuenta seleccionada no es válida o ya no existe.'
  }
  if (m.includes('foreign key') && m.includes('category')) {
    return 'La categoría seleccionada no es válida o ya no existe.'
  }
  if (m.includes('check constraint') && m.includes('amount')) {
    return 'El importe debe ser mayor que 0.'
  }
  if (m.includes('check constraint') && m.includes('concept')) {
    return 'El concepto es obligatorio.'
  }
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('network request failed')) {
    return 'Sin conexión con el servidor. Comprueba tu red e inténtalo de nuevo.'
  }
  return message
}

function throwFromError(error: { message: string } | null): never {
  throw new MoneyApiError(humanizeSupabaseError(error?.message ?? 'Error desconocido de Supabase'))
}

export async function listAccounts(userId: string): Promise<Account[]> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })
  if (error) throwFromError(error)
  return ((data as Account[]) ?? []).map(mapAccount)
}

export async function createAccount(payload: AccountInsert): Promise<Account> {
  ensureConfigured()
  const { data, error } = await supabase.from('accounts').insert(payload).select('*').single()
  if (error) throwFromError(error)
  return mapAccount(data as Account)
}

export async function updateAccount(id: string, payload: AccountUpdate): Promise<Account> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('accounts')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throwFromError(error)
  return mapAccount(data as Account)
}

export async function deleteAccount(id: string): Promise<void> {
  ensureConfigured()
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  if (error) throwFromError(error)
}

export async function listCategories(userId: string): Promise<Category[]> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('kind', { ascending: true })
    .order('name', { ascending: true })
  if (error) throwFromError(error)
  return (data as Category[]) ?? []
}

export async function createCategory(payload: CategoryInsert): Promise<Category> {
  ensureConfigured()
  const { data, error } = await supabase.from('categories').insert(payload).select('*').single()
  if (error) throwFromError(error)
  return data as Category
}

export async function updateCategory(id: string, payload: CategoryUpdate): Promise<Category> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('categories')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throwFromError(error)
  return data as Category
}

export async function deleteCategory(id: string): Promise<void> {
  ensureConfigured()
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throwFromError(error)
}

export async function listTransactions(userId: string): Promise<Transaction[]> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('occurred_at', { ascending: false })
  if (error) throwFromError(error)
  return ((data as Transaction[]) ?? []).map(mapTransaction)
}

export async function createTransaction(payload: TransactionInsert): Promise<Transaction> {
  ensureConfigured()
  const { data, error } = await supabase.from('transactions').insert(payload).select('*').single()
  if (error) throwFromError(error)
  return mapTransaction(data as Transaction)
}

/** Inserción por lotes (p. ej. importación de extracto). Máx. 100 por request. */
export async function createTransactionsBulk(
  payloads: TransactionInsert[],
): Promise<Transaction[]> {
  ensureConfigured()
  if (payloads.length === 0) return []

  const created: Transaction[] = []
  const chunkSize = 100
  for (let i = 0; i < payloads.length; i += chunkSize) {
    const chunk = payloads.slice(i, i + chunkSize)
    const { data, error } = await supabase.from('transactions').insert(chunk).select('*')
    if (error) throwFromError(error)
    for (const row of (data as Transaction[]) ?? []) {
      created.push(mapTransaction(row))
    }
  }
  return created
}

/**
 * Reconcilia el saldo de una cuenta creando un movimiento de ajuste
 * (ingreso o gasto) por la diferencia. No altera el historial previo
 * ni el opening_balance: el saldo derivado converge al objetivo.
 * Devuelve null si no hay diferencia.
 */
export async function reconcileAccountBalance(params: {
  userId: string
  accountId: string
  currentBalance: number
  targetBalance: number
}): Promise<Transaction | null> {
  const diff = roundMoney(toNumber(params.targetBalance) - toNumber(params.currentBalance))
  if (Math.abs(diff) < 0.005) return null

  const abs = Math.abs(diff)
  const type: TransactionType = diff > 0 ? 'income' : 'expense'
  const signedLabel = diff > 0 ? `+${abs.toFixed(2)}` : `−${abs.toFixed(2)}`

  return createTransaction({
    user_id: params.userId,
    account_id: params.accountId,
    category_id: null,
    type,
    amount: abs,
    concept: 'Ajuste de saldo',
    note: `Reconciliación: saldo en app ${toNumber(params.currentBalance).toFixed(2)} → ${toNumber(params.targetBalance).toFixed(2)} (diferencia ${signedLabel}). No borra movimientos anteriores.`,
    occurred_at: new Date().toISOString(),
    is_cleared: true,
    recurring_id: null,
    debt_id: null,
    receipt_path: null,
  })
}

export async function updateTransaction(
  id: string,
  payload: TransactionUpdate,
): Promise<Transaction> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('transactions')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throwFromError(error)
  return mapTransaction(data as Transaction)
}

export async function deleteTransaction(id: string): Promise<void> {
  ensureConfigured()
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throwFromError(error)
}

export async function listTransfers(userId: string): Promise<Transfer[]> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('transfers')
    .select('*')
    .eq('user_id', userId)
    .order('occurred_at', { ascending: false })
  if (error) throwFromError(error)
  return ((data as Transfer[]) ?? []).map(mapTransfer)
}

export async function createTransfer(payload: TransferInsert): Promise<Transfer> {
  ensureConfigured()
  if (payload.from_account_id === payload.to_account_id) {
    throw new MoneyApiError('Elige dos cuentas distintas para transferir.')
  }
  const { data, error } = await supabase.from('transfers').insert(payload).select('*').single()
  if (error) throwFromError(error)
  return mapTransfer(data as Transfer)
}

export async function updateTransfer(id: string, payload: TransferUpdate): Promise<Transfer> {
  ensureConfigured()
  if (
    payload.from_account_id &&
    payload.to_account_id &&
    payload.from_account_id === payload.to_account_id
  ) {
    throw new MoneyApiError('Elige dos cuentas distintas para transferir.')
  }
  const { data, error } = await supabase
    .from('transfers')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throwFromError(error)
  return mapTransfer(data as Transfer)
}

export async function deleteTransfer(id: string): Promise<void> {
  ensureConfigured()
  const { error } = await supabase.from('transfers').delete().eq('id', id)
  if (error) throwFromError(error)
}

export interface MoneySnapshot {
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  transfers: Transfer[]
}

export async function loadMoneySnapshot(userId: string): Promise<MoneySnapshot> {
  ensureConfigured()
  const [accounts, categories, transactions, transfers] = await Promise.all([
    listAccounts(userId),
    listCategories(userId),
    listTransactions(userId),
    listTransfers(userId),
  ])
  return { accounts, categories, transactions, transfers }
}

export function filterTransactions(params: {
  transactions: Transaction[]
  query?: string
  accountId?: string
  categoryId?: string
  tagId?: string
  type?: TransactionType | 'all'
  accountsById: Map<string, Account>
  categoriesById: Map<string, Category>
  tagsByTransaction?: Map<string, string[]>
  tagNamesByTransaction?: Map<string, string>
}): Transaction[] {
  const q = params.query?.trim().toLowerCase() ?? ''
  const type = params.type ?? 'all'

  return params.transactions.filter((tx) => {
    if (params.accountId && tx.account_id !== params.accountId) return false
    if (params.categoryId && tx.category_id !== params.categoryId) return false
    if (params.tagId) {
      const linked = params.tagsByTransaction?.get(tx.id) ?? []
      if (!linked.includes(params.tagId)) return false
    }
    if (type !== 'all' && tx.type !== type) return false
    if (!q) return true

    const accountName = params.accountsById.get(tx.account_id)?.name ?? ''
    const categoryName = tx.category_id
      ? (params.categoriesById.get(tx.category_id)?.name ?? '')
      : ''
    const tagNames = params.tagNamesByTransaction?.get(tx.id) ?? ''
    const haystack = [tx.concept, tx.note ?? '', accountName, categoryName, tagNames]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}
