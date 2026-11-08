import { useMemo, useState } from 'react'
import { ConfigBanner } from '@/components/money/ConfigBanner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'
import { useMoneyData } from '@/hooks/useMoneyData'
import {
  resolvePeriodRange,
  summarizePeriod,
  type PeriodPreset,
} from '@/lib/analysis'
import { formatMoney } from '@/lib/currency'
import { toDateInputValue } from '@/lib/dates'
import type { ReportExportParams } from '@/lib/reportShared'
import {
  buildReportHtml,
  buildTransactionsCsv,
  downloadTextFile,
  openPrintReport,
} from '@/lib/reports'

const PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: 'this_month', label: 'Este mes' },
  { id: 'last_month', label: 'Mes pasado' },
  { id: 'custom', label: 'Rango' },
]

export function InformesPage() {
  const { profile } = useAuth()
  const currency = profile?.currency ?? 'EUR'
  const money = useMoneyData()
  const [preset, setPreset] = useState<PeriodPreset>('this_month')
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return toDateInputValue(d)
  })
  const [customTo, setCustomTo] = useState(() => toDateInputValue())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'excel' | 'pdf' | null>(null)

  const range = useMemo(
    () => resolvePeriodRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  )
  const summary = useMemo(
    () => summarizePeriod(money.transactions, range),
    [money.transactions, range],
  )

  const rangeLabel =
    preset === 'this_month'
      ? 'Este mes'
      : preset === 'last_month'
        ? 'Mes pasado'
        : `${customFrom} → ${customTo}`

  const exportParams = useMemo((): ReportExportParams => {
    return {
      range,
      rangeLabel,
      currency,
      accounts: money.accounts,
      balancesByAccount: money.balancesByAccount,
      transactions: money.transactions,
      accountsById: money.accountsById,
      categoriesById: money.categoriesById,
    }
  }, [
    range,
    rangeLabel,
    currency,
    money.accounts,
    money.balancesByAccount,
    money.transactions,
    money.accountsById,
    money.categoriesById,
  ])

  async function handleExcel() {
    setError(null)
    setBusy('excel')
    try {
      const { downloadReportExcel } = await import('@/lib/reportExcel')
      await downloadReportExcel(exportParams)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el Excel.')
    } finally {
      setBusy(null)
    }
  }

  async function handlePdf() {
    setError(null)
    setBusy('pdf')
    try {
      const { downloadReportPdf } = await import('@/lib/reportPdf')
      await downloadReportPdf(exportParams)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el PDF.')
    } finally {
      setBusy(null)
    }
  }

  function handleCsv() {
    setError(null)
    try {
      const csv = buildTransactionsCsv({
        transactions: money.transactions,
        accountsById: money.accountsById,
        categoriesById: money.categoriesById,
        range,
        currency,
      })
      const stamp = toDateInputValue()
      downloadTextFile(
        `controlatusfinanzas-${stamp}.csv`,
        csv,
        'text/csv;charset=utf-8',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el CSV.')
    }
  }

  function handlePrint() {
    setError(null)
    try {
      const html = buildReportHtml({
        title: 'Informe — ControlaTusFinanzas',
        rangeLabel,
        currency,
        transactions: money.transactions,
        categoriesById: money.categoriesById,
        range,
      })
      openPrintReport(html)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir la impresión.')
    }
  }

  const disabled = money.loading || busy !== null

  return (
    <main className="page">
      <header className="page-header">
        <h1>Informes</h1>
        <p className="page-header-lead">Excel (.xlsx) o PDF del periodo.</p>
      </header>

      <div className="stack-md" style={{ maxWidth: '36rem' }}>
        <ConfigBanner configured={money.configured} error={money.error} />
        <ErrorBanner message={error} />

        <Card>
          <p className="label muted" style={{ fontSize: '0.75rem', marginBottom: '0.65rem' }}>
            Periodo
          </p>
          <div className="chip-row chip-row-scroll" role="group" aria-label="Periodo del informe">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`chip${preset === p.id ? ' chip-active' : ''}`}
                onClick={() => setPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' ? (
            <div className="filters-grid" style={{ marginTop: '0.75rem' }}>
              <Input
                label="Desde"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <Input
                label="Hasta"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          ) : null}
        </Card>

        <div className="summary-grid">
          <Card>
            <p className="label muted" style={{ fontSize: '0.7rem' }}>
              Ingresos
            </p>
            <p className="amount amount-income" style={{ margin: 0 }}>
              {formatMoney(summary.income, currency)}
            </p>
          </Card>
          <Card>
            <p className="label muted" style={{ fontSize: '0.7rem' }}>
              Gastos
            </p>
            <p className="amount amount-expense" style={{ margin: 0 }}>
              {formatMoney(summary.expense, currency)}
            </p>
          </Card>
          <Card elevated className="summary-span">
            <p className="label muted" style={{ fontSize: '0.7rem' }}>
              Balance · {summary.count} movimientos
            </p>
            <p
              className={`amount${summary.balance >= 0 ? ' amount-income' : ' amount-expense'}`}
              style={{ margin: 0 }}
            >
              {formatMoney(summary.balance, currency)}
            </p>
          </Card>
        </div>

        <Card>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Descargas</h2>
          <div className="header-actions" style={{ flexWrap: 'wrap' }}>
            <Button onClick={() => void handleExcel()} disabled={disabled}>
              {busy === 'excel' ? 'Generando Excel…' : 'Descargar Excel'}
            </Button>
            <Button variant="secondary" onClick={() => void handlePdf()} disabled={disabled}>
              {busy === 'pdf' ? 'Generando PDF…' : 'Descargar PDF'}
            </Button>
          </div>
          <div className="header-actions" style={{ flexWrap: 'wrap', marginTop: '0.65rem' }}>
            <Button variant="ghost" size="sm" onClick={handleCsv} disabled={disabled}>
              CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={handlePrint} disabled={disabled}>
              Imprimir
            </Button>
          </div>
          <p className="field-hint" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            El Excel incluye hojas de resumen, cuentas, movimientos y categorías. El PDF se
            descarga al dispositivo (sin servicios de pago). CSV e imprimir quedan como
            opciones secundarias.
          </p>
        </Card>
      </div>
    </main>
  )
}
