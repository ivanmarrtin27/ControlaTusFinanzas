import type { TransactionType } from '@/types/database'

const QUICK_ADD_KEY = 'ctf:quickAdd'
const AUTH_RETURN_KEY = 'ctf:authReturnTo'

export type QuickAddType = Extract<TransactionType, 'expense' | 'income'>

export function parseQuickParam(value: string | null | undefined): QuickAddType | null {
  if (value === 'expense' || value === 'income') return value
  return null
}

export function setQuickAddIntent(type: QuickAddType): void {
  try {
    sessionStorage.setItem(QUICK_ADD_KEY, type)
  } catch {
    /* private mode / quota */
  }
}

export function peekQuickAddIntent(): QuickAddType | null {
  try {
    return parseQuickParam(sessionStorage.getItem(QUICK_ADD_KEY))
  } catch {
    return null
  }
}

/** Reads and clears a pending quick-add intent (expense | income). */
export function consumeQuickAddIntent(): QuickAddType | null {
  try {
    const raw = sessionStorage.getItem(QUICK_ADD_KEY)
    sessionStorage.removeItem(QUICK_ADD_KEY)
    return parseQuickParam(raw)
  } catch {
    return null
  }
}

/** Absolute URLs for iOS Shortcuts / Control Center setup. */
export function quickAddUrls(origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const base = origin.replace(/\/$/, '')
  return {
    expense: `${base}/?quick=expense`,
    income: `${base}/?quick=income`,
    expenseMovimientos: `${base}/movimientos?nuevo=1&quick=expense`,
    incomeMovimientos: `${base}/movimientos?nuevo=1&quick=income`,
  } as const
}

export function setAuthReturnTo(pathWithSearch: string): void {
  try {
    sessionStorage.setItem(AUTH_RETURN_KEY, pathWithSearch)
  } catch {
    /* ignore */
  }
}

export function peekAuthReturnTo(): string | null {
  try {
    const value = sessionStorage.getItem(AUTH_RETURN_KEY)
    return value && value.startsWith('/') ? value : null
  } catch {
    return null
  }
}

export function consumeAuthReturnTo(): string | null {
  const value = peekAuthReturnTo()
  try {
    sessionStorage.removeItem(AUTH_RETURN_KEY)
  } catch {
    /* ignore */
  }
  return value
}
