/**
 * Exportación Excel (.xlsx) multihoja con ExcelJS (sin paywall).
 * Hojas típicas: resumen, gastos/ingresos por categoría, movimientos, cuentas.
 */
import ExcelJS from 'exceljs'
import { categoryBreakdown, summarizePeriod } from '@/lib/analysis'
import { ACCOUNT_TYPE_LABELS } from '@/lib/labels'
import {
  downloadBlob,
  filterMovements,
  stampFilename,
  type ReportExportParams,
} from '@/lib/reportShared'

function styleHeaderRow(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: 'FF121212' } }
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1DB954' },
  }
  row.alignment = { vertical: 'middle' }
}

export async function downloadReportExcel(params: ReportExportParams): Promise<void> {
  const summary = summarizePeriod(params.transactions, params.range)
  const expenses = categoryBreakdown(
    params.transactions,
    params.categoriesById,
    params.range,
    'expense',
  )
  const incomes = categoryBreakdown(
    params.transactions,
    params.categoriesById,
    params.range,
    'income',
  )
  const movements = filterMovements(params)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ControlaTusFinanzas'
  workbook.created = new Date()

  const resumen = workbook.addWorksheet('Resumen')
  resumen.columns = [
    { header: 'Concepto', key: 'label', width: 28 },
    { header: 'Valor', key: 'value', width: 22 },
  ]
  styleHeaderRow(resumen.getRow(1))
  resumen.addRows([
    { label: 'App', value: 'ControlaTusFinanzas' },
    { label: 'Periodo', value: params.rangeLabel },
    { label: 'Moneda', value: params.currency },
    { label: 'Ingresos', value: summary.income },
    { label: 'Gastos', value: summary.expense },
    { label: 'Balance', value: summary.balance },
    { label: 'Movimientos', value: summary.count },
  ])
  resumen.getCell('B5').numFmt = '#,##0.00'
  resumen.getCell('B6').numFmt = '#,##0.00'
  resumen.getCell('B7').numFmt = '#,##0.00'

  const cuentas = workbook.addWorksheet('Cuentas')
  cuentas.columns = [
    { header: 'Cuenta', key: 'name', width: 24 },
    { header: 'Tipo', key: 'type', width: 14 },
    { header: 'Estado', key: 'status', width: 12 },
    { header: 'Saldo actual', key: 'balance', width: 16 },
  ]
  styleHeaderRow(cuentas.getRow(1))
  const accountRows = [...params.accounts].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  for (const account of accountRows) {
    const row = cuentas.addRow({
      name: account.name,
      type: ACCOUNT_TYPE_LABELS[account.type] ?? account.type,
      status: account.is_active ? 'Activa' : 'Inactiva',
      balance: params.balancesByAccount.get(account.id) ?? 0,
    })
    row.getCell('balance').numFmt = '#,##0.00'
  }

  const movimientos = workbook.addWorksheet('Movimientos')
  movimientos.columns = [
    { header: 'Fecha', key: 'date', width: 14 },
    { header: 'Tipo', key: 'type', width: 12 },
    { header: 'Concepto', key: 'concept', width: 28 },
    { header: 'Cuenta', key: 'account', width: 18 },
    { header: 'Categoría', key: 'category', width: 18 },
    { header: 'Importe', key: 'amount', width: 14 },
    { header: 'Nota', key: 'note', width: 28 },
  ]
  styleHeaderRow(movimientos.getRow(1))
  for (const movement of movements) {
    const row = movimientos.addRow(movement)
    row.getCell('amount').numFmt = '#,##0.00'
  }

  const gastosCat = workbook.addWorksheet('Gastos por categoría')
  gastosCat.columns = [
    { header: 'Categoría', key: 'name', width: 24 },
    { header: 'Importe', key: 'amount', width: 14 },
    { header: '% del gasto', key: 'pct', width: 14 },
  ]
  styleHeaderRow(gastosCat.getRow(1))
  const expenseTotal = summary.expense || 1
  for (const row of expenses) {
    const excelRow = gastosCat.addRow({
      name: row.name,
      amount: row.amount,
      pct: row.amount / expenseTotal,
    })
    excelRow.getCell('amount').numFmt = '#,##0.00'
    excelRow.getCell('pct').numFmt = '0.0%'
  }

  const ingresosCat = workbook.addWorksheet('Ingresos por categoría')
  ingresosCat.columns = [
    { header: 'Categoría', key: 'name', width: 24 },
    { header: 'Importe', key: 'amount', width: 14 },
    { header: '% del ingreso', key: 'pct', width: 14 },
  ]
  styleHeaderRow(ingresosCat.getRow(1))
  const incomeTotal = summary.income || 1
  for (const row of incomes) {
    const excelRow = ingresosCat.addRow({
      name: row.name,
      amount: row.amount,
      pct: row.amount / incomeTotal,
    })
    excelRow.getCell('amount').numFmt = '#,##0.00'
    excelRow.getCell('pct').numFmt = '0.0%'
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  downloadBlob(stampFilename('controlatusfinanzas', 'xlsx'), blob)
}
