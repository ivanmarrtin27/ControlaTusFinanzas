import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { parseQuickParam, setQuickAddIntent } from '@/lib/quickAdd'

/**
 * Unifies PWA / home shortcuts `/?quick=expense|income` with Movimientos
 * (`/movimientos?nuevo=1&quick=...`). Persists intent so cold start + auth
 * loading still open the correct form.
 */
export function QuickAddRedirect() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.pathname !== '/') return
    const quick = parseQuickParam(new URLSearchParams(location.search).get('quick'))
    if (!quick) return

    setQuickAddIntent(quick)
    navigate(`/movimientos?nuevo=1&quick=${quick}`, { replace: true })
  }, [location.pathname, location.search, navigate])

  return null
}
