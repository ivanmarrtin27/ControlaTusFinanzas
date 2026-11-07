import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useVisibilityRefresh } from '@/hooks/useVisibilityRefresh'
import {
  computeBalancesByAccount,
  sumActiveBalances,
  summarizeMonth,
} from '@/lib/balances'
import { loadMoneySnapshot, MoneyApiError, type MoneySnapshot } from '@/lib/moneyApi'
import {
  buildTagsByTransaction,
  listTags,
  listTransactionTags,
} from '@/lib/tagApi'
import { readLastSyncedAt, writeLastSyncedAt } from '@/lib/syncMeta'
import type { Account, Category, Tag, Transaction, Transfer } from '@/types/database'

const EMPTY: MoneySnapshot = {
  accounts: [],
  categories: [],
  transactions: [],
  transfers: [],
}

export function useMoneyData() {
  const { user, configured } = useAuth()
  const [data, setData] = useState<MoneySnapshot>(EMPTY)
  const [tags, setTags] = useState<Tag[]>([])
  const [tagsByTransaction, setTagsByTransaction] = useState<Map<string, string[]>>(
    () => new Map(),
  )
  const [loading, setLoading] = useState(configured && Boolean(user))
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => readLastSyncedAt())

  const refresh = useCallback(async () => {
    if (!configured) {
      setData(EMPTY)
      setTags([])
      setTagsByTransaction(new Map())
      setError('Configura Supabase en .env para sincronizar tus datos.')
      setLoading(false)
      return
    }
    if (!user) {
      setData(EMPTY)
      setTags([])
      setTagsByTransaction(new Map())
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [snapshot, tagRows, links] = await Promise.all([
        loadMoneySnapshot(user.id),
        listTags(user.id),
        listTransactionTags(user.id),
      ])
      setData(snapshot)
      setTags(tagRows)
      setTagsByTransaction(buildTagsByTransaction(links))
      setLastSyncedAt(writeLastSyncedAt())
    } catch (err) {
      const message =
        err instanceof MoneyApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudieron cargar los datos.'
      setError(message)
      setData(EMPTY)
      setTags([])
      setTagsByTransaction(new Map())
    } finally {
      setLoading(false)
    }
  }, [configured, user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useVisibilityRefresh(refresh, configured && Boolean(user))

  const accountsById = useMemo(() => {
    const map = new Map<string, Account>()
    for (const account of data.accounts) map.set(account.id, account)
    return map
  }, [data.accounts])

  const categoriesById = useMemo(() => {
    const map = new Map<string, Category>()
    for (const category of data.categories) map.set(category.id, category)
    return map
  }, [data.categories])

  const tagsById = useMemo(() => {
    const map = new Map<string, Tag>()
    for (const tag of tags) map.set(tag.id, tag)
    return map
  }, [tags])

  const balancesByAccount = useMemo(
    () => computeBalancesByAccount(data.accounts, data.transactions, data.transfers),
    [data.accounts, data.transactions, data.transfers],
  )

  const totalBalance = useMemo(
    () => sumActiveBalances(data.accounts, balancesByAccount),
    [data.accounts, balancesByAccount],
  )

  const monthSummary = useMemo(
    () => summarizeMonth(data.transactions),
    [data.transactions],
  )

  const activeAccounts = useMemo(
    () => data.accounts.filter((a) => a.is_active),
    [data.accounts],
  )

  const activeCategories = useMemo(
    () => data.categories.filter((c) => c.is_active),
    [data.categories],
  )

  return {
    ...data,
    tags,
    tagsByTransaction,
    loading,
    error,
    lastSyncedAt,
    refresh,
    configured,
    userId: user?.id ?? null,
    accountsById,
    categoriesById,
    tagsById,
    balancesByAccount,
    totalBalance,
    monthSummary,
    activeAccounts,
    activeCategories,
    setLocalAccounts: (accounts: Account[]) => setData((prev) => ({ ...prev, accounts })),
    setLocalCategories: (categories: Category[]) =>
      setData((prev) => ({ ...prev, categories })),
    setLocalTransactions: (transactions: Transaction[]) =>
      setData((prev) => ({ ...prev, transactions })),
    setLocalTransfers: (transfers: Transfer[]) => setData((prev) => ({ ...prev, transfers })),
  }
}
