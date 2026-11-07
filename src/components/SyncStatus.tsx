import { formatLastSyncedLabel } from '@/lib/syncMeta'

type SyncStatusProps = {
  lastSyncedAt: string | null
  loading: boolean
  configured: boolean
  onRefresh?: () => void
}

export function SyncStatus({ lastSyncedAt, loading, configured, onRefresh }: SyncStatusProps) {
  if (!configured) return null

  return (
    <button
      type="button"
      className="sync-status"
      onClick={onRefresh}
      title="Actualizar datos"
      disabled={!onRefresh || loading}
    >
      {formatLastSyncedLabel(lastSyncedAt, loading)}
    </button>
  )
}
