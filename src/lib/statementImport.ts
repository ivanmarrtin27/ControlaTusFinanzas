/**
 * Importación de extractos bancarios/tarjeta (CSV y Excel).
 * Detecta columnas fecha / importe / concepto; permite mapeo manual.
 */
import { roundMoney, toNumber } from '@/lib/balances'
import { dateInputToIso, toDateInputValue } from '@/lib/dates'
import type { Transaction, TransactionType } from '@/types/database'
import type ExcelJS from 'exceljs'

export type StatementColumnRole = 'date' | 'amount' | 'description' | 'debit' | 'credit' | 'ignore'

export type ColumnMapping = {
  date: number | null
  amount: number | null
  description: number | null
  debit: number | null
  credit: number | null
}

export type ParsedTable = {
  headers: string[]
  rows: string[][]
  sourceName: string
  sourceKind: 'csv' | 'xlsx'
}

export type PreviewRow = {
  key: string
  dateInput: string
  amount: number
  type: TransactionType
  concept: string
  note: string | null
  duplicate: boolean
  selected: boolean
  rawLine: number
}

export type ImportParseResult = {
  table: ParsedTable
  mapping: ColumnMapping
  autoMapped: boolean
  preview: PreviewRow[]
  warnings: string[]
}

const DATE_ALIASES = [
  'fecha',
  'date',
  'f. valor',
  'f valor',
  'fecha valor',
  'fecha de valor',
  'fecha operacion',
  'fecha operación',
  'fecha contable',
  'f.operacion',
  'f.operación',
  'booking date',
  'value date',
  'operation date',
]

const AMOUNT_ALIASES = [
  'importe',
  'amount',
  'cantidad',
  'valor',
  'euro',
  'euros',
  'eur',
  'importeeuros',
  'importe eur',
  'signed amount',
  'movimiento',
]

const DESCRIPTION_ALIASES = [
  'concepto',
  'descripcion',
  'descripción',
  'description',
  'detalle',
  'detalles',
  'narrativa',
  'narrative',
  'beneficiario',
  'comercio',
  'merchant',
  'referencia',
  'observaciones',
  'texto',
  'movimiento',
  'asunto',
]

const DEBIT_ALIASES = [
  'cargo',
  'cargos',
  'debe',
  'debit',
  'débito',
  'debito',
  'salida',
  'retirada',
  'gasto',
  'withdrawals',
]

const CREDIT_ALIASES = [
  'abono',
  'abonos',
  'haber',
  'credit',
  'crédito',
  'credito',
  'ingreso',
  'entrada',
  'deposits',
]

function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_/]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function headerMatches(header: string, aliases: string[]): boolean {
  const n = normalizeHeader(header)
  if (!n) return false
  return aliases.some((alias) => {
    const a = normalizeHeader(alias)
    return n === a || n.includes(a) || a.includes(n)
  })
}

function findColumnIndex(headers: string[], aliases: string[], used: Set<number>): number | null {
  for (let i = 0; i < headers.length; i++) {
    if (used.has(i)) continue
    const h = headers[i] ?? ''
    if (headerMatches(h, aliases)) {
      used.add(i)
      return i
    }
  }
  return null
}

export function detectColumnMapping(headers: string[]): ColumnMapping {
  const used = new Set<number>()
  const date = findColumnIndex(headers, DATE_ALIASES, used)
  const debit = findColumnIndex(headers, DEBIT_ALIASES, used)
  const credit = findColumnIndex(headers, CREDIT_ALIASES, used)
  const amount =
    debit != null || credit != null ? null : findColumnIndex(headers, AMOUNT_ALIASES, used)
  const description = findColumnIndex(headers, DESCRIPTION_ALIASES, used)
  return { date, amount, description, debit, credit }
}

export function mappingIsComplete(mapping: ColumnMapping): boolean {
  if (mapping.date == null) return false
  if (mapping.description == null) return false
  const hasSigned = mapping.amount != null
  const hasSplit = mapping.debit != null || mapping.credit != null
  return hasSigned || hasSplit
}

/** Detecta separador CSV más probable entre ; , y tab. */
export function detectCsvDelimiter(sample: string): string {
  const firstLines = sample
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, 5)
  const candidates = [';', ',', '\t'] as const
  let best = ';'
  let bestScore = -1
  for (const delim of candidates) {
    const counts = firstLines.map((line) => splitCsvLine(line, delim).length)
    if (counts.length === 0) continue
    const first = counts[0] ?? 0
    if (first < 2) continue
    const consistent = counts.every((c) => c === first)
    const score = (consistent ? 1000 : 0) + first * 10 - Math.abs((counts[1] ?? first) - first)
    if (score > bestScore) {
      bestScore = score
      best = delim
    }
  }
  return best
}

export function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

export function parseCsvText(text: string, fileName: string): ParsedTable {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const delimiter = detectCsvDelimiter(cleaned)
  const lines = cleaned.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length === 0) {
    throw new Error('El CSV está vacío.')
  }
  const headers = splitCsvLine(lines[0]!, delimiter)
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, delimiter)
    while (cells.length < headers.length) cells.push('')
    return cells.slice(0, Math.max(headers.length, cells.length))
  })
  return {
    headers,
    rows,
    sourceName: fileName,
    sourceKind: 'csv',
  }
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value instanceof Date) return toDateInputValue(value)
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text
    if ('result' in value && value.result != null) return cellToString(value.result as ExcelJS.CellValue)
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((p) => p.text).join('')
    }
  }
  return String(value)
}

export async function parseXlsxFile(file: File): Promise<ParsedTable> {
  const ExcelJS = (await import('exceljs')).default
  const buffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error('El Excel no tiene hojas.')

  const matrix: string[][] = []
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = []
    const count = Math.max(row.cellCount, 1)
    for (let c = 1; c <= count; c++) {
      values.push(cellToString(row.getCell(c).value))
    }
    if (values.some((v) => v.trim())) matrix.push(values)
  })

  if (matrix.length === 0) throw new Error('La hoja de Excel está vacía.')

  const width = Math.max(...matrix.map((r) => r.length))
  const headers = (matrix[0] ?? []).map((h, i) => h.trim() || `Columna ${i + 1}`)
  while (headers.length < width) headers.push(`Columna ${headers.length + 1}`)

  const rows = matrix.slice(1).map((r) => {
    const cells = [...r]
    while (cells.length < headers.length) cells.push('')
    return cells.slice(0, headers.length)
  })

  return {
    headers,
    rows,
    sourceName: file.name,
    sourceKind: 'xlsx',
  }
}

export async function parseStatementFile(file: File): Promise<ParsedTable> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    if (name.endsWith('.xls') && !name.endsWith('.xlsx')) {
      throw new Error('Formato .xls antiguo no soportado. Guarda como .xlsx o CSV.')
    }
    return parseXlsxFile(file)
  }
  if (name.endsWith('.csv') || name.endsWith('.txt') || file.type.includes('csv') || file.type.includes('text')) {
    const text = await file.text()
    return parseCsvText(text, file.name)
  }
  // Intentar CSV por defecto
  try {
    const text = await file.text()
    return parseCsvText(text, file.name)
  } catch {
    throw new Error('Formato no reconocido. Usa .csv o .xlsx.')
  }
}

/** Parsea importes europeos/US: 1.234,56 | 1,234.56 | -12,50 | (12.50) */
export function parseAmount(raw: string): number | null {
  let s = raw.trim()
  if (!s || s === '-' || s === '—' || s === '–') return null

  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1).trim()
  }
  if (s.startsWith('+')) s = s.slice(1).trim()
  if (s.startsWith('-') || s.startsWith('−') || s.startsWith('–')) {
    negative = true
    s = s.slice(1).trim()
  }

  s = s.replace(/\s/g, '').replace(/€/g, '').replace(/EUR/gi, '')

  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    // El último separador suele ser el decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    // 12,50 o 1.234 → tratar coma como decimal si hay 1–2 dígitos tras ella
    const parts = s.split(',')
    if (parts.length === 2 && (parts[1]?.length ?? 0) <= 2) {
      s = `${parts[0]}.${parts[1]}`
    } else {
      s = s.replace(/,/g, '')
    }
  }

  const n = Number(s)
  if (!Number.isFinite(n)) return null
  const value = roundMoney(Math.abs(n))
  if (value === 0) return negative ? -0 : 0
  return negative ? -value : value
}

export function parseStatementDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null

  // Excel serial (días desde 1899-12-30) a veces llega como número string
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Number(s)
    if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
      const epoch = new Date(Date.UTC(1899, 11, 30))
      epoch.setUTCDate(epoch.getUTCDate() + Math.floor(serial))
      return toDateInputValue(
        new Date(epoch.getUTCFullYear(), epoch.getUTCMonth(), epoch.getUTCDate()),
      )
    }
  }

  // ISO / YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    const y = Number(iso[1])
    const m = Number(iso[2])
    const d = Number(iso[3])
    if (validYmd(y, m, d)) return toDateInputValue(new Date(y, m - 1, d))
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (dmy) {
    let y = Number(dmy[3])
    if (y < 100) y += y >= 70 ? 1900 : 2000
    const day = Number(dmy[1])
    const month = Number(dmy[2])
    // Prefer Spanish DMY; if month>12 and day<=12, swap (US)
    if (month > 12 && day <= 12) {
      if (validYmd(y, day, month)) return toDateInputValue(new Date(y, day - 1, month))
    }
    if (validYmd(y, month, day)) return toDateInputValue(new Date(y, month - 1, day))
  }

  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) return toDateInputValue(parsed)
  return null
}

function validYmd(y: number, m: number, d: number): boolean {
  if (y < 1970 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

function cellAt(row: string[], index: number | null): string {
  if (index == null || index < 0) return ''
  return row[index] ?? ''
}

export function duplicateKey(dateInput: string, amount: number, text: string): string {
  return `${dateInput}|${roundMoney(Math.abs(amount)).toFixed(2)}|${text.trim().toLowerCase()}`
}

export function buildExistingDuplicateKeys(
  transactions: Transaction[],
  accountId: string,
): Set<string> {
  const keys = new Set<string>()
  for (const tx of transactions) {
    if (tx.account_id !== accountId) continue
    const dateInput = toDateInputValue(tx.occurred_at)
    // Misma fecha + importe + concepto (el texto del banco va en concept).
    keys.add(duplicateKey(dateInput, tx.amount, tx.concept))
  }
  return keys
}

export function buildPreviewRows(
  table: ParsedTable,
  mapping: ColumnMapping,
  existingKeys: Set<string>,
): { preview: PreviewRow[]; warnings: string[] } {
  const warnings: string[] = []
  const preview: PreviewRow[] = []
  const seenInFile = new Set<string>()

  if (!mappingIsComplete(mapping)) {
    return {
      preview: [],
      warnings: ['Indica al menos Fecha, Concepto e Importe (o Cargo/Abono).'],
    }
  }

  table.rows.forEach((row, idx) => {
    const dateRaw = cellAt(row, mapping.date)
    const descRaw = cellAt(row, mapping.description)
    const dateInput = parseStatementDate(dateRaw)
    if (!dateInput) {
      if (dateRaw.trim()) warnings.push(`Fila ${idx + 2}: fecha no válida («${dateRaw}»).`)
      return
    }

    let signed: number | null = null
    if (mapping.amount != null) {
      signed = parseAmount(cellAt(row, mapping.amount))
    } else {
      const debit = parseAmount(cellAt(row, mapping.debit))
      const credit = parseAmount(cellAt(row, mapping.credit))
      const debitAbs = debit == null ? 0 : Math.abs(debit)
      const creditAbs = credit == null ? 0 : Math.abs(credit)
      if (debitAbs > 0 && creditAbs > 0) {
        warnings.push(`Fila ${idx + 2}: cargo y abono a la vez; se usa el mayor.`)
        signed = debitAbs >= creditAbs ? -debitAbs : creditAbs
      } else if (debitAbs > 0) {
        signed = -debitAbs
      } else if (creditAbs > 0) {
        signed = creditAbs
      } else {
        signed = null
      }
    }

    if (signed == null || !Number.isFinite(signed) || roundMoney(Math.abs(signed)) === 0) {
      if (cellAt(row, mapping.amount).trim() || cellAt(row, mapping.debit).trim() || cellAt(row, mapping.credit).trim()) {
        warnings.push(`Fila ${idx + 2}: importe no válido.`)
      }
      return
    }

    const amount = roundMoney(Math.abs(signed))
    const type: TransactionType = signed < 0 ? 'expense' : 'income'
    const concept = descRaw.trim() || 'Movimiento importado'
    const note = 'Importado desde extracto'
    const key = duplicateKey(dateInput, amount, concept)
    const duplicate = existingKeys.has(key) || seenInFile.has(key)
    seenInFile.add(key)

    preview.push({
      key: `${idx}-${key}`,
      dateInput,
      amount,
      type,
      concept: concept.slice(0, 200),
      note,
      duplicate,
      selected: !duplicate,
      rawLine: idx + 2,
    })
  })

  if (preview.length === 0 && warnings.length === 0) {
    warnings.push('No se encontraron filas con fecha e importe válidos.')
  }

  return { preview, warnings: warnings.slice(0, 12) }
}

export function applyMappingToTable(
  table: ParsedTable,
  mapping: ColumnMapping,
  existingKeys: Set<string>,
): ImportParseResult {
  const auto = detectColumnMapping(table.headers)
  const autoMapped =
    auto.date === mapping.date &&
    auto.amount === mapping.amount &&
    auto.description === mapping.description &&
    auto.debit === mapping.debit &&
    auto.credit === mapping.credit
  const { preview, warnings } = buildPreviewRows(table, mapping, existingKeys)
  return { table, mapping, autoMapped, preview, warnings }
}

export function prepareImportResult(
  table: ParsedTable,
  existingKeys: Set<string>,
  mappingOverride?: ColumnMapping,
): ImportParseResult {
  const mapping = mappingOverride ?? detectColumnMapping(table.headers)
  return applyMappingToTable(table, mapping, existingKeys)
}

export function previewToInsertPayload(
  row: PreviewRow,
  userId: string,
  accountId: string,
): {
  user_id: string
  account_id: string
  category_id: null
  type: TransactionType
  amount: number
  concept: string
  note: string | null
  occurred_at: string
  is_cleared: boolean
  recurring_id: null
  debt_id: null
  receipt_path: null
} {
  return {
    user_id: userId,
    account_id: accountId,
    category_id: null,
    type: row.type,
    amount: toNumber(row.amount),
    concept: row.concept,
    note: row.note,
    occurred_at: dateInputToIso(row.dateInput),
    is_cleared: true,
    recurring_id: null,
    debt_id: null,
    receipt_path: null,
  }
}

export const COLUMN_ROLE_OPTIONS: { value: StatementColumnRole; label: string }[] = [
  { value: 'ignore', label: 'Ignorar' },
  { value: 'date', label: 'Fecha' },
  { value: 'description', label: 'Concepto' },
  { value: 'amount', label: 'Importe (con signo)' },
  { value: 'debit', label: 'Cargo / Debe' },
  { value: 'credit', label: 'Abono / Haber' },
]

export function mappingFromRoles(roles: StatementColumnRole[]): ColumnMapping {
  const find = (role: StatementColumnRole) => {
    const i = roles.indexOf(role)
    return i >= 0 ? i : null
  }
  return {
    date: find('date'),
    description: find('description'),
    amount: find('amount'),
    debit: find('debit'),
    credit: find('credit'),
  }
}

export function rolesFromMapping(headers: string[], mapping: ColumnMapping): StatementColumnRole[] {
  return headers.map((_, i) => {
    if (mapping.date === i) return 'date'
    if (mapping.description === i) return 'description'
    if (mapping.amount === i) return 'amount'
    if (mapping.debit === i) return 'debit'
    if (mapping.credit === i) return 'credit'
    return 'ignore'
  })
}
