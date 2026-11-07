/**
 * Guarda las rutas de la app detrás de sesión Supabase.
 * Sin .env configurado deja pasar (modo demo / revisión del shell).
 * Con sesión ausente redirige a login guardando la URL de origen.
 */
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, configured } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="auth-shell">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <p className="muted">Cargando sesión…</p>
        </div>
      </div>
    )
  }

  // Demo local: sin Supabase no bloqueamos rutas.
  if (!configured) {
    return <>{children}</>
  }

  if (!session) {
    return (
      <Navigate
        to="/auth/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  return <>{children}</>
}
