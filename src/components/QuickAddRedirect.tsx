import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Unifies PWA / home shortcuts `/?quick=expense|income` with Movimientos
 * (`/movimientos?nuevo=1&quick=...`).
 */
export function QuickAddRedirect() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.pathname !== '/') return
    const params = new URLSearchParams(location.search)
    const quick = params.get('quick')
    if (quick !== 'expense' && quick !== 'income') return

    navigate(`/movimientos?nuevo=1&quick=${quick}`, { replace: true })
  }, [location.pathname, location.search, navigate])

  return null
}
