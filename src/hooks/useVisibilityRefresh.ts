import { useEffect, useRef } from 'react'

const MIN_INTERVAL_MS = 15_000

/**
 * Refetch when the tab becomes visible or the window gains focus.
 * Debounced so rapid focus/blur cycles don't spam Supabase.
 */
export function useVisibilityRefresh(refresh: () => void | Promise<void>, enabled = true) {
  const lastRun = useRef(0)
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    if (!enabled) return

    const run = () => {
      if (document.visibilityState === 'hidden') return
      const now = Date.now()
      if (now - lastRun.current < MIN_INTERVAL_MS) return
      lastRun.current = now
      void refreshRef.current()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') run()
    }

    window.addEventListener('focus', run)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', run)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled])
}
