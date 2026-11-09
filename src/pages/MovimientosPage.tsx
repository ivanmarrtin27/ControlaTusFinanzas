import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useMoneyData } from '@/hooks/useMoneyData'
import { ConfigBanner } from '@/components/money/ConfigBanner'
import { TemplateChips } from '@/components/money/TemplateChips'
import {
  TransactionForm,
  type TransactionSubmitValues,
} from '@/components/money/TransactionForm'
import { TransferForm } from '@/components/money/TransferForm'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Sheet } from '@/components/ui/Sheet'
import { MoneyListSkeleton } from '@/components/ui/Skeleton'
import { formatMoney } from '@/lib/currency'
import { formatShortDate } from '@/lib/dates'
import {
  createTransaction,
  createTransfer,
  deleteTransaction,
  deleteTransfer,
  filterTransactions,
  MoneyApiError,
  updateTransaction,
  updateTransfer,
} from '@/lib/moneyApi'
import { deleteReceipt, uploadReceipt } from '@/lib/receiptApi'
import {
  consumeQuickAddIntent,
  parseQuickParam,
  peekQuickAddIntent,
  setQuickAddIntent,
  type QuickAddType,
} from '@/lib/quickAdd'
import { setTransactionTags } from '@/lib/tagApi'
import { listTemplates } from '@/lib/templateApi'
import type {
  Transaction,
  TransactionTemplate,
  TransactionType,
  Transfer,
} from '@/types/database'

type SheetMode = 'transaction' | 'transfer' | null

type Prefill = Partial<Transaction> & { type?: TransactionType; tag_ids?: string[] }

type TypeFilter = TransactionType | 'all' | 'transfer'

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'expense', label: 'Gastos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'transfer', label: 'Transfer.' },
]

export function MovimientosPage() {
  const { profile } = useAuth()
  const currency = profile?.currency ?? 'EUR'
  const money = useMoneyData()
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [query, setQuery] = useState('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [tagId, setTagId] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [sheetMode, setSheetMode] = useState<SheetMode>(null)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null)
  const [prefill, setPrefill] = useState<Prefill>({ type: 'expense', tag_ids: [] })
  const [formKey, setFormKey] = useState(0)
  const [busyError, setBusyError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<TransactionTemplate[]>([])
  const quickOpenHandledRef = useRef(false)

  const refreshTemplates = useCallback(async () => {
    if (!money.userId || !money.configured) {
      setTemplates([])
      return
    }
    try {
      setTemplates(await listTemplates(money.userId))
    } catch {
      setTemplates([])
    }
  }, [money.userId, money.configured])

  useEffect(() => {
    void refreshTemplates()
  }, [refreshTemplates])

  const tagNamesByTransaction = useMemo(() => {
    const map = new Map<string, string>()
    for (const [txId, ids] of money.tagsByTransaction) {
      map.set(
        txId,
        ids
          .map((id) => money.tagsById.get(id)?.name ?? '')
          .filter(Boolean)
          .join(' '),
      )
    }
    return map
  }, [money.tagsByTransaction, money.tagsById])

  useEffect(() => {
    const nuevo = searchParams.get('nuevo')
    const quickFromUrl = parseQuickParam(searchParams.get('quick'))
    const transfer = searchParams.get('transferencia')
    const plantilla = searchParams.get('plantilla')

    if (transfer === '1') {
      setEditingTransfer(null)
      setSheetMode('transfer')
      navigate('/movimientos', { replace: true })
      return
    }

    if (plantilla) {
      const tpl = templates.find((t) => t.id === plantilla)
      if (tpl) {
        applyTemplate(tpl)
        navigate('/movimientos', { replace: true })
        return
      }
      if (templates.length > 0 || !money.userId) {
        navigate('/movimientos', { replace: true })
      }
      return
    }

    if (quickFromUrl) setQuickAddIntent(quickFromUrl)

    const storedQuick = peekQuickAddIntent()
    const triggeredByUrl = nuevo === '1' || quickFromUrl != null
    const shouldOpen = triggeredByUrl || storedQuick != null
    if (!shouldOpen) return

    // Same mount after cleaning the URL: don't reopen / reset the form.
    if (quickOpenHandledRef.current) {
      consumeQuickAddIntent()
      return
    }
    quickOpenHandledRef.current = true

    const type: TransactionType = (quickFromUrl ?? storedQuick ?? 'expense') satisfies QuickAddType
    setPrefill({ type, tag_ids: [] })
    setEditingTx(null)
    setFormKey((k) => k + 1)
    setSheetMode('transaction')

    if (triggeredByUrl) {
      navigate('/movimientos', { replace: true })
      // Keep intent briefly so a Strict Mode remount can reopen the sheet.
      window.setTimeout(() => consumeQuickAddIntent(), 400)
    } else {
      consumeQuickAddIntent()
    }
  }, [searchParams, navigate, templates, money.userId])

  function applyTemplate(tpl: TransactionTemplate) {
    setEditingTx(null)
    setPrefill({
      type: tpl.type,
      amount: tpl.amount,
      concept: tpl.name,
      note: tpl.note,
      account_id: tpl.account_id ?? undefined,
      category_id: tpl.category_id,
      tag_ids: [],
    })
    setFormKey((k) => k + 1)
    setSheetMode('transaction')
  }

  const filteredTx = useMemo(() => {
    if (typeFilter === 'transfer') return []
    return filterTransactions({
      transactions: money.transactions,
      query,
      accountId: accountId || undefined,
      categoryId: categoryId || undefined,
      tagId: tagId || undefined,
      type: typeFilter === 'all' ? 'all' : typeFilter,
      accountsById: money.accountsById,
      categoriesById: money.categoriesById,
      tagsByTransaction: money.tagsByTransaction,
      tagNamesByTransaction,
    })
  }, [
    money.transactions,
    money.accountsById,
    money.categoriesById,
    money.tagsByTransaction,
    tagNamesByTransaction,
    query,
    accountId,
    categoryId,
    tagId,
    typeFilter,
  ])

  const filteredTransfers = useMemo(() => {
    if (typeFilter === 'income' || typeFilter === 'expense') return []
    const q = query.trim().toLowerCase()
    return money.transfers.filter((tr) => {
      if (accountId && tr.from_account_id !== accountId && tr.to_account_id !== accountId) {
        return false
      }
      if (!q) return true
      const from = money.accountsById.get(tr.from_account_id)?.name ?? ''
      const to = money.accountsById.get(tr.to_account_id)?.name ?? ''
      return [tr.concept ?? '', from, to].join(' ').toLowerCase().includes(q)
    })
  }, [money.transfers, money.accountsById, query, accountId, typeFilter])

  type FeedItem =
    | { kind: 'tx'; at: string; tx: Transaction }
    | { kind: 'transfer'; at: string; transfer: Transfer }

  const feed = useMemo(() => {
    const items: FeedItem[] = []
    if (typeFilter !== 'transfer') {
      for (const tx of filteredTx) items.push({ kind: 'tx', at: tx.occurred_at, tx })
    }
    if (typeFilter === 'all' || typeFilter === 'transfer') {
      for (const transfer of filteredTransfers) {
        items.push({ kind: 'transfer', at: transfer.occurred_at, transfer })
      }
    }
    items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    return items
  }, [filteredTx, filteredTransfers, typeFilter])

  function openNewTransaction(type: TransactionType = 'expense') {
    setPrefill({ type, tag_ids: [] })
    setEditingTx(null)
    setFormKey((k) => k + 1)
    setSheetMode('transaction')
  }

  function openNewTransfer() {
    setEditingTransfer(null)
    setSheetMode('transfer')
  }

  function openEditTransaction(tx: Transaction) {
    setEditingTx(tx)
    setFormKey((k) => k + 1)
    setSheetMode('transaction')
  }

  function openEditTransfer(tr: Transfer) {
    setEditingTransfer(tr)
    setSheetMode('transfer')
  }

  async function handleSaveTransaction(values: TransactionSubmitValues) {
    if (!money.userId) throw new MoneyApiError('Inicia sesión para guardar movimientos.')
    setBusyError(null)
    const wasEdit = Boolean(editingTx)
    const { tag_ids, receipt_file, clear_receipt, ...payload } = values
    let txId = editingTx?.id
    let previousPath = editingTx?.receipt_path ?? null

    if (editingTx) {
      await updateTransaction(editingTx.id, payload)
    } else {
      const created = await createTransaction({
        ...payload,
        user_id: money.userId,
        receipt_path: null,
      })
      txId = created.id
    }

    if (!txId) throw new MoneyApiError('No se pudo obtener el movimiento.')

    await setTransactionTags(money.userId, txId, tag_ids)

    if (receipt_file) {
      const path = await uploadReceipt(money.userId, txId, receipt_file)
      await updateTransaction(txId, { receipt_path: path })
      if (previousPath && previousPath !== path) {
        try {
          await deleteReceipt(previousPath)
        } catch {
          /* ignore orphan cleanup errors */
        }
      }
    } else if (clear_receipt && previousPath) {
      await updateTransaction(txId, { receipt_path: null })
      try {
        await deleteReceipt(previousPath)
      } catch {
        /* ignore */
      }
    }

    setSheetMode(null)
    setEditingTx(null)
    toast.success(wasEdit ? 'Movimiento actualizado' : 'Movimiento guardado')
    await money.refresh()
  }

  async function handleSaveTransfer(values: {
    from_account_id: string
    to_account_id: string
    amount: number
    concept: string | null
    occurred_at: string
  }) {
    if (!money.userId) throw new MoneyApiError('Inicia sesión para guardar transferencias.')
    setBusyError(null)
    const wasEdit = Boolean(editingTransfer)
    if (editingTransfer) {
      await updateTransfer(editingTransfer.id, values)
    } else {
      await createTransfer({ ...values, user_id: money.userId })
    }
    setSheetMode(null)
    setEditingTransfer(null)
    toast.success(wasEdit ? 'Transferencia actualizada' : 'Transferencia guardada')
    await money.refresh()
  }

  async function handleDeleteTx() {
    if (!editingTx) return
    if (!window.confirm('¿Eliminar este movimiento?')) return
    try {
      const path = editingTx.receipt_path
      await deleteTransaction(editingTx.id)
      if (path) {
        try {
          await deleteReceipt(path)
        } catch {
          /* ignore */
        }
      }
      setSheetMode(null)
      setEditingTx(null)
      toast.success('Movimiento eliminado')
      await money.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar.')
    }
  }

  async function handleDeleteTransfer() {
    if (!editingTransfer) return
    if (!window.confirm('¿Eliminar esta transferencia?')) return
    try {
      await deleteTransfer(editingTransfer.id)
      setSheetMode(null)
      setEditingTransfer(null)
      toast.success('Transferencia eliminada')
      await money.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar.')
    }
  }

  const accountOptions = [
    { value: '', label: 'Todas las cuentas' },
    ...money.accounts.map((a) => ({ value: a.id, label: a.name })),
  ]
  const categoryOptions = [
    { value: '', label: 'Todas las categorías' },
    ...money.categories
      .filter((c) => typeFilter === 'all' || typeFilter === 'transfer' || c.kind === typeFilter)
      .map((c) => ({ value: c.id, label: c.name })),
  ]
  const tagOptions = [
    { value: '', label: 'Todas las etiquetas' },
    ...money.tags.map((t) => ({ value: t.id, label: t.name })),
  ]

  const formInitial: Prefill = editingTx
    ? {
        ...editingTx,
        tag_ids: money.tagsByTransaction.get(editingTx.id) ?? [],
      }
    : prefill

  const filtersActive = Boolean(query || accountId || categoryId || tagId || typeFilter !== 'all')

  return (
    <main className="page page-movimientos">
      <header className="page-header page-header-row">
        <div>
          <h1>Movimientos</h1>
          <p className="page-header-lead">Ingresos, gastos y transferencias.</p>
        </div>
        <div className="header-actions action-pair movimientos-actions">
          <Button variant="secondary" size="sm" onClick={openNewTransfer} disabled={!money.userId}>
            Transferir
          </Button>
          <Button size="sm" onClick={() => openNewTransaction('expense')} disabled={!money.userId}>
            Añadir
          </Button>
        </div>
      </header>

      <div className="stack-md">
        <ConfigBanner configured={money.configured} error={money.error} />
        <ErrorBanner message={busyError} />

        {templates.length > 0 ? (
          <div>
            <div className="section-head" style={{ marginBottom: '0.35rem' }}>
              <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
                Plantillas rápidas
              </p>
              <Link to="/plantillas" className="text-link" style={{ fontSize: '0.8rem' }}>
                Gestionar
              </Link>
            </div>
            <TemplateChips
              templates={templates}
              currency={currency}
              onSelect={applyTemplate}
            />
          </div>
        ) : null}

        <div className="movimientos-filters">
          <Input
            label="Buscar"
            name="search"
            hideLabel
            placeholder="Buscar concepto, cuenta…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
          />

          <div className="chip-row chip-row-scroll" role="group" aria-label="Filtrar por tipo">
            {TYPE_FILTERS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`chip${typeFilter === opt.value ? ' chip-active' : ''}`}
                onClick={() => setTypeFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="filters-grid filters-grid-compact">
            <Select
              label="Cuenta"
              hideLabel
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              options={accountOptions}
            />
            <Select
              label="Categoría"
              hideLabel
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={categoryOptions}
              disabled={typeFilter === 'transfer'}
            />
            {money.tags.length > 0 ? (
              <Select
                label="Etiqueta"
                hideLabel
                value={tagId}
                onChange={(e) => setTagId(e.target.value)}
                options={tagOptions}
                disabled={typeFilter === 'transfer'}
              />
            ) : null}
          </div>

          {filtersActive ? (
            <button
              type="button"
              className="text-link movimientos-clear-filters"
              onClick={() => {
                setQuery('')
                setAccountId('')
                setCategoryId('')
                setTagId('')
                setTypeFilter('all')
              }}
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>

        {money.loading ? (
          <MoneyListSkeleton rows={6} />
        ) : feed.length === 0 ? (
          <EmptyState
            title="Sin movimientos"
            description={
              money.activeAccounts.length === 0
                ? 'Primero crea una cuenta, luego registra un ingreso o gasto.'
                : filtersActive
                  ? 'Ningún movimiento coincide con los filtros.'
                  : 'Añade un movimiento o una transferencia para verlos aquí.'
            }
            action={
              filtersActive ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery('')
                    setAccountId('')
                    setCategoryId('')
                    setTagId('')
                    setTypeFilter('all')
                  }}
                >
                  Limpiar filtros
                </Button>
              ) : money.activeAccounts.length === 0 ? (
                <Button onClick={() => navigate('/cuentas')}>Crear cuenta</Button>
              ) : (
                <div className="empty-state-ctas action-pair">
                  <Button variant="secondary" onClick={openNewTransfer}>
                    Transferir
                  </Button>
                  <Button onClick={() => openNewTransaction('expense')}>Añadir movimiento</Button>
                </div>
              )
            }
          />
        ) : (
          <div className="money-list">
            {feed.map((item) => {
              if (item.kind === 'tx') {
                const tx = item.tx
                const account = money.accountsById.get(tx.account_id)
                const category = tx.category_id
                  ? money.categoriesById.get(tx.category_id)
                  : undefined
                const txTags = (money.tagsByTransaction.get(tx.id) ?? [])
                  .map((id) => money.tagsById.get(id))
                  .filter(Boolean)
                const signed = tx.type === 'income' ? tx.amount : -tx.amount
                const metaParts = [
                  formatShortDate(tx.occurred_at),
                  account?.name,
                  category?.name,
                  txTags.length > 0 ? txTags.map((t) => t!.name).join(', ') : null,
                ].filter(Boolean)
                return (
                  <button
                    key={`tx-${tx.id}`}
                    type="button"
                    className="money-row"
                    aria-label={`Editar ${tx.concept}`}
                    onClick={() => openEditTransaction(tx)}
                  >
                    <span
                      className="money-dot"
                      style={{ background: category?.color ?? account?.color ?? 'var(--accent)' }}
                    />
                    <span className="money-row-main">
                      <strong>
                        {tx.concept}
                        {tx.receipt_path ? (
                          <span className="money-row-badge" title="Con ticket" aria-label="Con ticket">
                            ticket
                          </span>
                        ) : null}
                      </strong>
                      <span className="muted money-row-meta">{metaParts.join(' · ')}</span>
                    </span>
                    <span className="money-row-end">
                      <span
                        className={`amount${tx.type === 'expense' ? ' amount-expense' : ' amount-income'}`}
                      >
                        {formatMoney(signed, currency)}
                      </span>
                      <span className="money-row-hint muted">Editar</span>
                    </span>
                  </button>
                )
              }

              const tr = item.transfer
              const from = money.accountsById.get(tr.from_account_id)?.name ?? 'Origen'
              const to = money.accountsById.get(tr.to_account_id)?.name ?? 'Destino'
              return (
                <button
                  key={`tr-${tr.id}`}
                  type="button"
                  className="money-row money-row-transfer"
                  aria-label={`Editar transferencia ${tr.concept?.trim() || ''}`}
                  onClick={() => openEditTransfer(tr)}
                >
                  <span className="money-dot" style={{ background: 'var(--text-muted)' }} />
                  <span className="money-row-main">
                    <strong>{tr.concept?.trim() || 'Transferencia'}</strong>
                    <span className="muted money-row-meta money-row-meta-wrap">
                      <span className="money-row-meta-date">{formatShortDate(tr.occurred_at)}</span>
                      <span className="money-row-route">
                        <span className="money-row-account">{from}</span>
                        <span className="money-row-route-arrow" aria-hidden="true">
                          →
                        </span>
                        <span className="money-row-account">{to}</span>
                      </span>
                    </span>
                  </span>
                  <span className="money-row-end">
                    <span className="amount">{formatMoney(tr.amount, currency)}</span>
                    <span className="money-row-hint muted">Editar</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <Sheet
        open={sheetMode === 'transaction'}
        title={editingTx ? 'Editar movimiento' : 'Nuevo movimiento'}
        onClose={() => {
          setSheetMode(null)
          setEditingTx(null)
        }}
        footer={
          editingTx ? (
            <Button variant="destructive" block onClick={() => void handleDeleteTx()}>
              Eliminar movimiento
            </Button>
          ) : null
        }
      >
        {!editingTx && templates.length > 0 ? (
          <div style={{ marginBottom: '0.85rem' }}>
            <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 0.35rem' }}>
              Aplicar plantilla
            </p>
            <TemplateChips
              templates={templates}
              currency={currency}
              onSelect={applyTemplate}
            />
          </div>
        ) : null}
        <TransactionForm
          key={editingTx?.id ?? `new-${formKey}`}
          accounts={money.accounts}
          categories={money.categories}
          tags={money.tags}
          initial={formInitial}
          submitLabel={editingTx ? 'Guardar cambios' : 'Crear movimiento'}
          onSubmit={handleSaveTransaction}
          onCancel={() => {
            setSheetMode(null)
            setEditingTx(null)
          }}
        />
      </Sheet>

      <Sheet
        open={sheetMode === 'transfer'}
        title={editingTransfer ? 'Editar transferencia' : 'Nueva transferencia'}
        onClose={() => {
          setSheetMode(null)
          setEditingTransfer(null)
        }}
        footer={
          editingTransfer ? (
            <Button variant="destructive" block onClick={() => void handleDeleteTransfer()}>
              Eliminar transferencia
            </Button>
          ) : null
        }
      >
        <TransferForm
          key={editingTransfer?.id ?? 'new-transfer'}
          accounts={money.accounts}
          initial={editingTransfer ?? undefined}
          submitLabel={editingTransfer ? 'Guardar cambios' : 'Transferir'}
          onSubmit={handleSaveTransfer}
          onCancel={() => {
            setSheetMode(null)
            setEditingTransfer(null)
          }}
        />
      </Sheet>
    </main>
  )
}
