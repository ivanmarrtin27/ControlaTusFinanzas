/**
 * Utilidades compartidas por CSV / HTML / Excel / PDF de informes.
 * `filterMovements` normaliza filas del periodo para todas las exportaciones.
 */
import { toNumber } from '@/lib/balances'
import { formatShortDate, toDateInputValue } from '@/lib/dates'
import { TRANSACTION_TYPE_LABELS } from '@/lib/labels'
import type { DateRange } from '@/lib/analysis'
import type { Account, Category, Transaction } from '@/types/database'

export type ReportExportParams = {
  range: DateRange
  rangeLabel: string
  currency: string
  accounts: Account[]
  balancesByAccount: Map<string, number>
  transactions: Transaction[]
  accountsById: Map<string, Account>
  categoriesById: Map<string, Category>
}

export type MovementRow = {
  date: string
  type: string
  concept: string
  account: string
  category: string
  amount: number
  note: string
}

export function stampFilename(prefix: string, ext: string): string {
  return `${prefix}-${toDateInputValue()}.${ext}`
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function filterMovements(params: ReportExportParams): MovementRow[] {
  const start = params.range.start.getTime()
  const end = params.range.end.getTime()
  const rows: (MovementRow & { at: number })[] = []

  for (const tx of params.transactions) {
    const at = new Date(tx.occurred_at).getTime()
    if (at < start || at >= end) continue
    rows.push({
      at,
      date: formatShortDate(tx.occurred_at),
      type: TRANSACTION_TYPE_LABELS[tx.type],
      concept: tx.concept,
      account: params.accountsById.get(tx.account_id)?.name ?? '',
      category: tx.category_id
        ? (params.categoriesById.get(tx.category_id)?.name ?? '')
        : '',
      amount: tx.type === 'income' ? toNumber(tx.amount) : -toNumber(tx.amount),
      note: tx.note ?? '',
    })
  }

  rows.sort((a, b) => b.at - a.at)
  return rows.map(({ at: _at, ...row }) => row)
}
