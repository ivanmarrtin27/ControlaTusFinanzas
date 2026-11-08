/** Remember last used account for faster expense/income entry. */

const LAST_ACCOUNT_KEY = 'ctf-last-account-id'

export function getLastAccountId(): string | null {
  try {
    return localStorage.getItem(LAST_ACCOUNT_KEY)
  } catch {
    return null
  }
}

export function setLastAccountId(accountId: string): void {
  if (!accountId) return
  try {
    localStorage.setItem(LAST_ACCOUNT_KEY, accountId)
  } catch {
    /* ignore quota / private mode */
  }
}

/** Prefer last account when it is still active; otherwise first active. */
export function resolveDefaultAccountId(
  accounts: { id: string; is_active: boolean }[],
  preferredId?: string | null,
): string {
  const active = accounts.filter((a) => a.is_active)
  if (preferredId && active.some((a) => a.id === preferredId)) return preferredId
  const last = getLastAccountId()
  if (last && active.some((a) => a.id === last)) return last
  return active[0]?.id ?? ''
}
