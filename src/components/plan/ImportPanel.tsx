/**
 * Planificación → Importar: extracto CSV/Excel → movimientos en una cuenta.
 */
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Select } from '@/components/ui/Select'
import { MoneyListSkeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/contexts/ToastContext'
import { formatMoney } from '@/lib/currency'
import { dateInputToIso, formatShortDate } from '@/lib/dates'
import { ACCOUNT_TYPE_LABELS } from '@/lib/labels'
import { createTransactionsBulk, MoneyApiError } from '@/lib/moneyApi'
import {
  COLUMN_ROLE_OPTIONS,
  buildExistingDuplicateKeys,
  mappingFromRoles,
  mappingIsComplete,
  parseStatementFile,
  prepareImportResult,
  previewToInsertPayload,
  rolesFromMapping,
  type ImportParseResult,
  type PreviewRow,
  type StatementColumnRole,
} from '@/lib/statementImport'
import type { Account, Transaction } from '@/types/database'

interface ImportPanelProps {
  currency: string
  userId: string | null
  configured: boolean
  loading: boolean
  accounts: Account[]
  transactions: Transaction[]
  onChanged: () => Promise<void>
}

type Step = 'idle' | 'map' | 'preview'

export function ImportPanel({
  currency,
  userId,
  configured,
  loading,
  accounts,
  transactions,
  onChanged,
}: ImportPanelProps) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const activeAccounts = useMemo(() => accounts.filter((a) => a.is_active), [accounts])
  const [accountId, setAccountId] = useState('')
  const [step, setStep] = useState<Step>('idle')
  const [parse, setParse] = useState<ImportParseResult | null>(null)
  const [roles, setRoles] = useState<StatementColumnRole[]>([])
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const accountOptions = useMemo(
    () =>
      activeAccounts.map((a) => ({
        value: a.id,
        label: `${a.name} (${ACCOUNT_TYPE_LABELS[a.type] ?? a.type})`,
      })),
    [activeAccounts],
  )

  const selectedAccount = activeAccounts.find((a) => a.id === accountId) ?? null

  const summary = useMemo(() => {
    const selected = preview.filter((r) => r.selected)
    let income = 0
    let expense = 0
    for (const r of selected) {
      if (r.type === 'income') income += r.amount
      else expense += r.amount
    }
    const skipped = preview.filter((r) => !r.selected).length
    const duplicates = preview.filter((r) => r.duplicate).length
    return { selected: selected.length, income, expense, skipped, duplicates, total: preview.length }
  }, [preview])

  function resetFileState() {
    setStep('idle')
    setParse(null)
    setRoles([])
    setPreview([])
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function existingKeysFor(account: string) {
    return buildExistingDuplicateKeys(transactions, account)
  }

  async function handleFile(file: File | null) {
    setError(null)
    if (!file) return
    if (!accountId) {
      setError('Elige primero la cuenta de destino (p. ej. Tarjeta o Cuenta bancaria).')
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    setBusy(true)
    try {
      const table = await parseStatementFile(file)
      const result = prepareImportResult(table, existingKeysFor(accountId))
      setParse(result)
      setRoles(rolesFromMapping(table.headers, result.mapping))
      setPreview(result.preview)
      setStep(mappingIsComplete(result.mapping) && result.preview.length > 0 ? 'preview' : 'map')
      if (!mappingIsComplete(result.mapping)) {
        setError('No se detectaron las columnas automáticamente. Asigna Fecha, Concepto e Importe.')
      }
    } catch (err) {
      resetFileState()
      setError(err instanceof Error ? err.message : 'No se pudo leer el archivo.')
    } finally {
      setBusy(false)
    }
  }

  function applyRoles(nextRoles: StatementColumnRole[]) {
    if (!parse) return
    setRoles(nextRoles)
    const mapping = mappingFromRoles(nextRoles)
    const result = prepareImportResult(parse.table, existingKeysFor(accountId), mapping)
    setParse(result)
    setPreview(result.preview)
    if (mappingIsComplete(mapping) && result.preview.length > 0) {
      setStep('preview')
      setError(null)
    } else {
      setStep('map')
    }
  }

  function setRoleAt(index: number, role: StatementColumnRole) {
    const next = [...roles]
    // Un rol (salvo ignore) solo en una columna
    if (role !== 'ignore') {
      for (let i = 0; i < next.length; i++) {
        if (i !== index && next[i] === role) next[i] = 'ignore'
      }
    }
    next[index] = role
    applyRoles(next)
  }

  function toggleRow(key: string) {
    setPreview((prev) =>
      prev.map((r) => (r.key === key ? { ...r, selected: !r.selected } : r)),
    )
  }

  function selectAllImportable() {
    setPreview((prev) => prev.map((r) => ({ ...r, selected: !r.duplicate })))
  }

  function clearSelection() {
    setPreview((prev) => prev.map((r) => ({ ...r, selected: false })))
  }

  async function confirmImport() {
    if (!userId || !accountId || !selectedAccount) return
    const rows = preview.filter((r) => r.selected)
    if (rows.length === 0) {
      setError('No hay filas seleccionadas para importar.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const payloads = rows.map((r) => previewToInsertPayload(r, userId, accountId))
      await createTransactionsBulk(payloads)
      await onChanged()
      toast.success(
        `Importados ${rows.length} movimiento${rows.length === 1 ? '' : 's'} en «${selectedAccount.name}»`,
      )
      resetFileState()
    } catch (err) {
      const message =
        err instanceof MoneyApiError || err instanceof Error
          ? err.message
          : 'Error al importar movimientos.'
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  if (!configured) {
    return (
      <ErrorBanner tone="info" message="Configura Supabase para importar extractos." />
    )
  }

  if (loading && activeAccounts.length === 0) {
    return <MoneyListSkeleton rows={4} />
  }

  if (activeAccounts.length === 0) {
    return (
      <EmptyState
        title="Necesitas una cuenta"
        description="Crea una cuenta (bancaria, tarjeta…) y vuelve para importar el extracto."
        action={
          <Link to="/cuentas" className="btn btn-sm btn-primary">
            Ir a Cuentas
          </Link>
        }
      />
    )
  }

  return (
    <div className="stack-md import-panel">
      <Card>
        <h2 className="import-panel-title">Importar extracto</h2>
        <p className="field-hint" style={{ marginBottom: '0.75rem' }}>
          Sube un CSV o Excel del banco/tarjeta. Se crearán movimientos en la cuenta elegida; el
          saldo y los deltas se actualizan solos. No conecta con Open Banking.
        </p>

        <Select
          label="Cuenta de destino"
          value={accountId}
          onChange={(e) => {
            setAccountId(e.target.value)
            resetFileState()
          }}
          options={accountOptions}
          placeholder="Elige cuenta…"
          hint="Todos los movimientos del archivo se asignan a esta cuenta."
        />

        <div className="import-file-row">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            id="statement-file"
            disabled={busy || !accountId}
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
          />
          <Button
            variant="secondary"
            disabled={busy || !accountId}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? 'Leyendo…' : 'Elegir archivo CSV / Excel'}
          </Button>
          {parse ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={resetFileState}>
              Quitar archivo
            </Button>
          ) : null}
        </div>

        {parse ? (
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            Archivo: {parse.table.sourceName} ({parse.table.sourceKind.toUpperCase()},{' '}
            {parse.table.rows.length} filas)
            {parse.autoMapped ? ' · columnas detectadas' : ' · mapeo manual'}
          </p>
        ) : null}

        {error ? (
          <div style={{ marginTop: '0.75rem' }}>
            <ErrorBanner message={error} />
          </div>
        ) : null}
      </Card>

      <Card>
        <button
          type="button"
          className="import-help-toggle"
          aria-expanded={helpOpen}
          onClick={() => setHelpOpen((v) => !v)}
        >
          <strong>Cómo descargar el extracto del banco</strong>
          <span className="muted">{helpOpen ? 'Ocultar' : 'Ver ayuda'}</span>
        </button>
        {helpOpen ? (
          <div className="import-help-body">
            <ol className="import-help-list">
              <li>Abre la app o web de tu banco / tarjeta.</li>
              <li>
                Entra en la cuenta o tarjeta → <em>Movimientos</em>, <em>Extracto</em> o{' '}
                <em>Descargar</em>.
              </li>
              <li>
                Elige periodo y formato <strong>CSV</strong> (recomendado) o <strong>Excel
                (.xlsx)</strong>.
              </li>
              <li>En esta pantalla elige la misma cuenta en ControlaTusFinanzas y sube el archivo.</li>
              <li>
                Revisa la vista previa: el signo define ingreso (+) o gasto (−). Los duplicados
                (misma fecha + importe + concepto) se omiten.
              </li>
            </ol>
            <p className="field-hint" style={{ marginTop: '0.5rem' }}>
              Formatos: CSV con separador <code>;</code> o <code>,</code> (típico en España), y
              Excel .xlsx (primera hoja). Columnas habituales: Fecha, Concepto/Descripción, Importe;
              o Cargo + Abono.
            </p>
          </div>
        ) : null}
      </Card>

      {step === 'map' && parse ? (
        <Card>
          <h3 className="import-panel-title">Asignar columnas</h3>
          <p className="field-hint" style={{ marginBottom: '0.75rem' }}>
            Indica qué columna es Fecha, Concepto e Importe (o Cargo/Abono).
          </p>
          <div className="stack-sm">
            {parse.table.headers.map((header, i) => (
              <Select
                key={`col-${i}`}
                label={header || `Columna ${i + 1}`}
                value={roles[i] ?? 'ignore'}
                onChange={(e) => setRoleAt(i, e.target.value as StatementColumnRole)}
                options={COLUMN_ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              />
            ))}
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <Button
              variant="primary"
              disabled={!mappingIsComplete(mappingFromRoles(roles)) || busy}
              onClick={() => applyRoles(roles)}
            >
              Ver vista previa
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 'preview' && parse ? (
        <Card>
          <div className="section-head">
            <div>
              <strong>Vista previa</strong>
              <p className="muted" style={{ fontSize: '0.8rem', margin: '0.2rem 0 0' }}>
                {summary.selected} de {summary.total} listos · ingresos{' '}
                {formatMoney(summary.income, currency)} · gastos{' '}
                {formatMoney(summary.expense, currency)}
                {summary.duplicates > 0 ? ` · ${summary.duplicates} duplicado(s)` : ''}
              </p>
            </div>
            <button type="button" className="text-link" onClick={() => setStep('map')}>
              Columnas
            </button>
          </div>

          {parse.warnings.length > 0 ? (
            <div style={{ margin: '0.5rem 0 0.75rem' }}>
              <ErrorBanner
                tone="info"
                message={parse.warnings.slice(0, 4).join(' · ')}
              />
            </div>
          ) : null}

          <div className="chip-row" style={{ marginBottom: '0.5rem' }}>
            <button type="button" className="chip" onClick={selectAllImportable}>
              Seleccionar nuevos
            </button>
            <button type="button" className="chip" onClick={clearSelection}>
              Quitar selección
            </button>
          </div>

          <ul className="import-preview-list">
            {preview.slice(0, 80).map((row) => (
              <li key={row.key}>
                <label className={`money-row money-row-static import-preview-row${row.duplicate ? ' is-duplicate' : ''}`}>
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={() => toggleRow(row.key)}
                    disabled={busy}
                  />
                  <span className="money-row-main">
                    <strong>{row.concept}</strong>
                    <span className="muted">
                      {formatShortDate(dateInputToIso(row.dateInput))}
                      {row.duplicate ? ' · duplicado (omitido)' : ''}
                      {row.type === 'income' ? ' · ingreso' : ' · gasto'}
                    </span>
                  </span>
                  <span className={`money-row-end amount${row.type === 'expense' ? ' amount-expense' : ' amount-income'}`}>
                    {row.type === 'expense' ? '−' : '+'}
                    {formatMoney(row.amount, currency)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {preview.length > 80 ? (
            <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
              Mostrando 80 de {preview.length}. Al confirmar se importan todas las seleccionadas.
            </p>
          ) : null}

          <div className="import-confirm-row">
            <Button
              variant="primary"
              block
              disabled={busy || summary.selected === 0}
              onClick={() => void confirmImport()}
            >
              {busy
                ? 'Importando…'
                : `Confirmar ${summary.selected} movimiento${summary.selected === 1 ? '' : 's'}`}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  )
}
