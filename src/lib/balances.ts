import type { Account, Transaction, Transfer } from '@/types/database'

/**
 * Saldos derivados (sin columna materializada):
 * opening_balance + ingresos − gastos − salidas de transferencia + entradas de transferencia.
 * Las transferencias viven en `transfers` (no en `transactions`), así no se cuentan
 * como ingreso/gasto ni se duplican en el patrimonio total.
 */
export function computeAccountBalance(
  account: Pick<Account, 'id' | 'opening_balance'>,
  transactions: Pick<Transaction, 'account_id' | 'type' | 'amount'>[],
  transfers: Pick<Transfer, 'from_account_id' | 'to_account_id' | 'amount'>[],
): number {
  let balance = toNumber(account.opening_balance)

  for (const tx of transactions) {
    if (tx.account_id !== account.id) continue
    const amount = toNumber(tx.amount)
    balance += tx.type === 'income' ? amount : -amount
  }

  for (const tr of transfers) {
    const amount = toNumber(tr.amount)
    if (tr.from_account_id === account.id) balance -= amount
    if (tr.to_account_id === account.id) balance += amount
  }

  return roundMoney(balance)
}

export function computeBalancesByAccount(
  accounts: Pick<Account, 'id' | 'opening_balance'>[],
  transactions: Pick<Transaction, 'account_id' | 'type' | 'amount'>[],
  transfers: Pick<Transfer, 'from_account_id' | 'to_account_id' | 'amount'>[],
): Map<string, number> {
  const map = new Map<string, number>()
  for (const account of accounts) {
    map.set(account.id, computeAccountBalance(account, transactions, transfers))
  }
  return map
}

export function sumActiveBalances(
  accounts: Pick<Account, 'id' | 'opening_balance' | 'is_active'>[],
  balances: Map<string, number>,
): number {
  let total = 0
  for (const account of accounts) {
    if (!account.is_active) continue
    total += balances.get(account.id) ?? 0
  }
  return roundMoney(total)
}

export function monthBounds(reference = new Date()): { start: Date; end: Date } {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1)
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1)
  return { start, end }
}

export function summarizeMonth(
  transactions: Pick<Transaction, 'type' | 'amount' | 'occurred_at'>[],
  reference = new Date(),
): { income: number; expense: number; balance: number } {
  const { start, end } = monthBounds(reference)
  let income = 0
  let expense = 0

  for (const tx of transactions) {
    const at = new Date(tx.occurred_at)
    if (at < start || at >= end) continue
    const amount = toNumber(tx.amount)
    if (tx.type === 'income') income += amount
    else expense += amount
  }

  return {
    income: roundMoney(income),
    expense: roundMoney(expense),
    balance: roundMoney(income - expense),
  }
}

export function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function dayBounds(reference = new Date()): { start: Date; end: Date } {
  const start = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

/** Semana calendario lunes–domingo (locale ES). */
export function weekBounds(reference = new Date()): { start: Date; end: Date } {
  const day = reference.getDay() // 0 domingo
  const mondayOffset = day === 0 ? -6 : 1 - day
  const start = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() + mondayOffset)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return { start, end }
}

export function summarizeRange(
  transactions: Pick<Transaction, 'type' | 'amount' | 'occurred_at'>[],
  start: Date,
  end: Date,
): { income: number; expense: number; balance: number } {
  let income = 0
  let expense = 0
  for (const tx of transactions) {
    const at = new Date(tx.occurred_at)
    if (at < start || at >= end) continue
    const amount = toNumber(tx.amount)
    if (tx.type === 'income') income += amount
    else expense += amount
  }
  return {
    income: roundMoney(income),
    expense: roundMoney(expense),
    balance: roundMoney(income - expense),
  }
}
