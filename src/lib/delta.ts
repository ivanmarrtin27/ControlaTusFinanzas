import type { Account, Transaction, Transfer } from '@/types/database'
import {
  computeAccountBalanceAsOf,
  dayBounds,
  monthBounds,
  roundMoney,
  sumActiveBalances,
  toNumber,
} from '@/lib/balances'
import { formatMoney } from '@/lib/currency'

export type DeltaPolarity = 'wealth' | 'cost'

export type MoneyDelta = {
  absolute: number
  /** null si no hay base comparable (p. ej. saldo previo 0 y hay cambio). */
  ratio: number | null
  direction: 'up' | 'down' | 'flat'
}

/** Variación relativa: (actual − anterior) / |anterior|. */
export function relativeChangeRatio(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return (current - previous) / Math.abs(previous)
}

export function buildMoneyDelta(current: number, previous: number): MoneyDelta {
  const absolute = roundMoney(current - previous)
  const ratio = relativeChangeRatio(current, previous)
  const direction: MoneyDelta['direction'] =
    absolute > 0.004 ? 'up' : absolute < -0.004 ? 'down' : 'flat'
  return { absolute, ratio, direction }
}

/**
 * Patrimonio (cuentas activas) vs un instante `asOf` (exclusive).
 * currentBalances: mapa ya calculado del saldo actual.
 */
export function netWorthDeltaSince(
  accounts: Pick<Account, 'id' | 'opening_balance' | 'is_active'>[],
  currentBalances: Map<string, number>,
  transactions: Pick<Transaction, 'account_id' | 'type' | 'amount' | 'occurred_at'>[],
  transfers: Pick<Transfer, 'from_account_id' | 'to_account_id' | 'amount' | 'occurred_at'>[],
  asOf: Date,
): MoneyDelta {
  const current = sumActiveBalances(accounts, currentBalances)
  let previous = 0
  for (const account of accounts) {
    if (!account.is_active) continue
    previous += computeAccountBalanceAsOf(account, transactions, transfers, asOf)
  }
  return buildMoneyDelta(current, roundMoney(previous))
}

export function accountDeltaSince(
  account: Pick<Account, 'id' | 'opening_balance'>,
  currentBalance: number,
  transactions: Pick<Transaction, 'account_id' | 'type' | 'amount' | 'occurred_at'>[],
  transfers: Pick<Transfer, 'from_account_id' | 'to_account_id' | 'amount' | 'occurred_at'>[],
  asOf: Date,
): MoneyDelta {
  const previous = computeAccountBalanceAsOf(account, transactions, transfers, asOf)
  return buildMoneyDelta(currentBalance, previous)
}

export function monthStartAsOf(reference = new Date()): Date {
  return monthBounds(reference).start
}

export function todayStartAsOf(reference = new Date()): Date {
  return dayBounds(reference).start
}

/** Clase CSS: verde si sube el patrimonio / baja el coste; rojo al revés. */
export function deltaToneClass(
  direction: MoneyDelta['direction'],
  polarity: DeltaPolarity = 'wealth',
): string {
  if (direction === 'flat') return 'delta-flat'
  const positiveIsGood = polarity === 'wealth' ? direction === 'up' : direction === 'down'
  return positiveIsGood ? 'amount-income' : 'amount-expense'
}

export function formatDeltaAbsolute(
  absolute: number,
  currency: string,
  options?: { showPlus?: boolean },
): string {
  const showPlus = options?.showPlus ?? true
  const formatted = formatMoney(Math.abs(absolute), currency)
  if (Math.abs(absolute) < 0.005) return formatMoney(0, currency)
  if (absolute > 0) return showPlus ? `+${formatted}` : formatted
  return `−${formatted}`
}

export function formatDeltaPercent(ratio: number | null, digits = 1): string {
  if (ratio == null || !Number.isFinite(ratio)) return '—'
  const pct = ratio * 100
  if (Math.abs(pct) < 0.05) return '0 %'
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : ''
  return `${sign}${Math.abs(pct).toFixed(digits)} %`
}

/** Etiqueta corta ES: «sube», «baja» o «igual». */
export function deltaVerb(direction: MoneyDelta['direction']): string {
  if (direction === 'up') return 'sube'
  if (direction === 'down') return 'baja'
  return 'igual'
}

export function formatDeltaArrow(direction: MoneyDelta['direction']): string {
  if (direction === 'up') return '↑'
  if (direction === 'down') return '↓'
  return '→'
}

/** Importe de ajuste para reconciliar: target − current. */
export function reconcileDiff(currentBalance: number, targetBalance: number): number {
  return roundMoney(toNumber(targetBalance) - toNumber(currentBalance))
}
