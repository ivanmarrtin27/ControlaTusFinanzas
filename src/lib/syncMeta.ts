const STORAGE_KEY = 'ctf_last_synced_at'

export function readLastSyncedAt(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function writeLastSyncedAt(iso = new Date().toISOString()): string {
  try {
    localStorage.setItem(STORAGE_KEY, iso)
  } catch {
    /* ignore quota / private mode */
  }
  return iso
}

export function formatLastSyncedLabel(iso: string | null, loading: boolean): string {
  if (loading) return 'Sincronizando…'
  if (!iso) return 'Sin sincronizar'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'Sin sincronizar'
  const diffSec = Math.round((Date.now() - then) / 1000)
  if (diffSec < 45) return 'Sincronizado ahora'
  if (diffSec < 3600) {
    const mins = Math.max(1, Math.round(diffSec / 60))
    return `Sincronizado hace ${mins} min`
  }
  return `Sincronizado a las ${new Date(iso).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}
