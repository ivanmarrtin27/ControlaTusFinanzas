/**
 * Exportación PDF multi-sección (resumen, categorías, movimientos, saldos).
 * Usa jsPDF + autotable; el periodo y la moneda vienen de InformesPage.
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { categoryBreakdown, expenseByCategory, summarizePeriod } from '@/lib/analysis'
import { formatMoney } from '@/lib/currency'
import { formatShortDate } from '@/lib/dates'
import { ACCOUNT_TYPE_LABELS } from '@/lib/labels'
import {
  filterMovements,
  stampFilename,
  type ReportExportParams,
} from '@/lib/reportShared'

type DocWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } }

export async function downloadReportPdf(params: ReportExportParams): Promise<void> {
  const summary = summarizePeriod(params.transactions, params.range)
  const expenses = expenseByCategory(
    params.transactions,
    params.categoriesById,
    params.range,
  )
  const incomes = categoryBreakdown(
    params.transactions,
    params.categoriesById,
    params.range,
    'income',
  )
  const movements = filterMovements(params)
  const expenseTotal = summary.expense || 1
  const incomeTotal = summary.income || 1

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 14
  let y = 18

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(18, 18, 18)
  doc.text('ControlaTusFinanzas', margin, y)
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text('Informe financiero', margin, y)
  y += 6
  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  doc.text(`Periodo: ${params.rangeLabel}`, margin, y)
  y += 5
  doc.text(`Moneda: ${params.currency}`, margin, y)
  y += 5
  doc.text(`Generado: ${formatShortDate(new Date().toISOString())}`, margin, y)
  y += 8

  doc.setTextColor(18, 18, 18)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Resumen del periodo', margin, y)
  y += 2

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Concepto', 'Importe']],
    body: [
      ['Ingresos', formatMoney(summary.income, params.currency)],
      ['Gastos', formatMoney(summary.expense, params.currency)],
      ['Balance', formatMoney(summary.balance, params.currency)],
      ['Movimientos', String(summary.count)],
    ],
    theme: 'striped',
    headStyles: { fillColor: [29, 185, 84], textColor: [18, 18, 18], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2.5 },
  })
  y = (doc as DocWithAutoTable).lastAutoTable.finalY + 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Cuentas (saldos actuales)', margin, y)
  y += 2

  const accountBody = [...params.accounts]
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .map((account) => [
      account.name,
      ACCOUNT_TYPE_LABELS[account.type] ?? account.type,
      account.is_active ? 'Activa' : 'Inactiva',
      formatMoney(params.balancesByAccount.get(account.id) ?? 0, params.currency),
    ])

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Cuenta', 'Tipo', 'Estado', 'Saldo']],
    body: accountBody.length ? accountBody : [['—', '—', '—', 'Sin cuentas']],
    theme: 'striped',
    headStyles: { fillColor: [29, 185, 84], textColor: [18, 18, 18], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 3: { halign: 'right' } },
  })
  y = (doc as DocWithAutoTable).lastAutoTable.finalY + 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Gastos por categoría', margin, y)
  y += 2

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Categoría', 'Importe', '%']],
    body: expenses.length
      ? expenses.map((row) => [
          row.name,
          formatMoney(row.amount, params.currency),
          `${((row.amount / expenseTotal) * 100).toFixed(0)}%`,
        ])
      : [['Sin gastos en el periodo', '—', '—']],
    theme: 'striped',
    headStyles: { fillColor: [29, 185, 84], textColor: [18, 18, 18], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
  })
  y = (doc as DocWithAutoTable).lastAutoTable.finalY + 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Ingresos por categoría', margin, y)
  y += 2

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Categoría', 'Importe', '%']],
    body: incomes.length
      ? incomes.map((row) => [
          row.name,
          formatMoney(row.amount, params.currency),
          `${((row.amount / incomeTotal) * 100).toFixed(0)}%`,
        ])
      : [['Sin ingresos en el periodo', '—', '—']],
    theme: 'striped',
    headStyles: { fillColor: [29, 185, 84], textColor: [18, 18, 18], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
  })
  y = (doc as DocWithAutoTable).lastAutoTable.finalY + 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Movimientos del periodo', margin, y)
  y += 2

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Fecha', 'Tipo', 'Concepto', 'Cuenta', 'Categoría', 'Importe']],
    body: movements.length
      ? movements.map((row) => [
          row.date,
          row.type,
          row.concept,
          row.account,
          row.category || '—',
          formatMoney(row.amount, params.currency),
        ])
      : [['—', '—', 'Sin movimientos', '—', '—', '—']],
    theme: 'striped',
    headStyles: { fillColor: [29, 185, 84], textColor: [18, 18, 18], fontStyle: 'bold' },
    styles: { fontSize: 7.5, cellPadding: 1.8, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 18 },
      2: { cellWidth: 45 },
      3: { cellWidth: 28 },
      4: { cellWidth: 28 },
      5: { cellWidth: 28, halign: 'right' },
    },
    didDrawPage: () => {
      const page = doc.getNumberOfPages()
      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.text(
        `ControlaTusFinanzas · ${params.rangeLabel} · pág. ${page}`,
        margin,
        doc.internal.pageSize.getHeight() - 8,
      )
    },
  })

  doc.save(stampFilename('controlatusfinanzas-informe', 'pdf'))
}
