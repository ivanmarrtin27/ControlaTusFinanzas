/**
 * Informes ligeros: CSV (`;` + BOM UTF-8 para Excel ES) y HTML imprimible.
 * Excel (.xlsx) y PDF viven en `reportExcel.ts` / `reportPdf.ts`.
 */
import { expenseByCategory, summarizePeriod, type DateRange } from '@/lib/analysis'
import { formatMoney } from '@/lib/currency'
import { formatShortDate } from '@/lib/dates'
import { downloadBlob } from '@/lib/reportShared'
import type { Account, Category, Transaction } from '@/types/database'

export type { ReportExportParams } from '@/lib/reportShared'
export { downloadBlob } from '@/lib/reportShared'

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function buildTransactionsCsv(params: {
  transactions: Transaction[]
  accountsById: Map<string, Account>
  categoriesById: Map<string, Category>
  range: DateRange
  currency: string
}): string {
  const header = ['Fecha', 'Tipo', 'Concepto', 'Cuenta', 'Categoría', 'Importe', 'Nota']
  const rows = [header.join(';')]
  const start = params.range.start.getTime()
  const end = params.range.end.getTime()

  for (const tx of params.transactions) {
    const at = new Date(tx.occurred_at).getTime()
    if (at < start || at >= end) continue
    const account = params.accountsById.get(tx.account_id)?.name ?? ''
    const category = tx.category_id
      ? (params.categoriesById.get(tx.category_id)?.name ?? '')
      : ''
    const signed = tx.type === 'income' ? tx.amount : -tx.amount
    rows.push(
      [
        formatShortDate(tx.occurred_at),
        tx.type === 'income' ? 'Ingreso' : 'Gasto',
        csvEscape(tx.concept),
        csvEscape(account),
        csvEscape(category),
        String(signed).replace('.', ','),
        csvEscape(tx.note ?? ''),
      ].join(';'),
    )
  }
  return `\uFEFF${rows.join('\n')}`
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  downloadBlob(filename, new Blob([content], { type: mime }))
}

export function buildReportHtml(params: {
  title: string
  rangeLabel: string
  currency: string
  transactions: Transaction[]
  categoriesById: Map<string, Category>
  range: DateRange
}): string {
  const summary = summarizePeriod(params.transactions, params.range)
  const categories = expenseByCategory(
    params.transactions,
    params.categoriesById,
    params.range,
  )

  const expenseTotal = summary.expense || 1
  const catRows = categories
    .map(
      (c) =>
        `<tr><td>${escapeHtml(c.name)}</td><td style="text-align:right">${escapeHtml(
          formatMoney(c.amount, params.currency),
        )}</td><td style="text-align:right">${((c.amount / expenseTotal) * 100).toFixed(0)}%</td></tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(params.title)}</title>
<style>
  body { font-family: DM Sans, Segoe UI, sans-serif; color: #111; margin: 2rem; }
  h1 { font-size: 1.4rem; margin: 0 0 0.25rem; }
  .muted { color: #555; margin-bottom: 1.5rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th, td { border-bottom: 1px solid #ddd; padding: 0.5rem; text-align: left; }
  th { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 0.75rem; }
  .amount { font-family: ui-monospace, monospace; font-size: 1.1rem; }
  @media print { body { margin: 0.75rem; } }
</style>
</head>
<body>
  <h1>${escapeHtml(params.title)}</h1>
  <p class="muted">${escapeHtml(params.rangeLabel)}</p>
  <div class="cards">
    <div class="card"><div>Ingresos</div><div class="amount">${escapeHtml(formatMoney(summary.income, params.currency))}</div></div>
    <div class="card"><div>Gastos</div><div class="amount">${escapeHtml(formatMoney(summary.expense, params.currency))}</div></div>
    <div class="card"><div>Balance</div><div class="amount">${escapeHtml(formatMoney(summary.balance, params.currency))}</div></div>
  </div>
  <h2>Gastos por categoría</h2>
  <table>
    <thead><tr><th>Categoría</th><th>Importe</th><th>%</th></tr></thead>
    <tbody>${catRows || '<tr><td colspan="3">Sin gastos en el periodo</td></tr>'}</tbody>
  </table>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function openPrintReport(html: string): void {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700')
  if (!win) {
    throw new Error('El navegador bloqueó la ventana de impresión. Permite pop-ups e inténtalo de nuevo.')
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
}
