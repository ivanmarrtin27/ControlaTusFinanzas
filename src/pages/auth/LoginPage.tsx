import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Input } from '@/components/ui/Input'
import { authErrorMessage } from '@/lib/authErrors'
import { consumeAuthReturnTo, peekAuthReturnTo, peekQuickAddIntent } from '@/lib/quickAdd'

function resolvePostLoginPath(stateFrom: string | undefined): string {
  if (stateFrom && stateFrom.startsWith('/')) return stateFrom
  const stored = peekAuthReturnTo()
  if (stored) return stored
  const quick = peekQuickAddIntent()
  if (quick) return `/movimientos?nuevo=1&quick=${quick}`
  return '/'
}

export function LoginPage() {
  const { signIn, signInWithGoogle, session, loading, configured } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const stateFrom = (location.state as { from?: string } | null)?.from
  const fromRef = useRef(resolvePostLoginPath(stateFrom))
  const from = fromRef.current

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && session) consumeAuthReturnTo()
  }, [loading, session])

  if (!loading && session) {
    return <Navigate to={from} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error: err } = await signIn({ email, password })
    setSubmitting(false)
    if (err) {
      setError(authErrorMessage(err))
      return
    }
    consumeAuthReturnTo()
    navigate(from, { replace: true })
  }

  async function onGoogle() {
    setError(null)
    const { error: err } = await signInWithGoogle()
    if (err) {
      setError(
        /provider is not enabled/i.test(err.message)
          ? 'Google no está activado en este proyecto. Usa correo y contraseña, o configura Google en Supabase → Authentication → Providers.'
          : authErrorMessage(err),
      )
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">ControlaTusFinanzas</div>
          <p>Entra para gestionar tu espacio personal.</p>
        </div>

        <ErrorBanner
          tone="info"
          message={
            configured
              ? null
              : 'Falta configurar Supabase. Copia .env.example a .env y añade tus claves.'
          }
        />
        <ErrorBanner message={error} />

        <form className="auth-form" onSubmit={(e) => void onSubmit(e)}>
          <Input
            label="Correo"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Contraseña"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" block disabled={submitting || !configured}>
            {submitting ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>

        <div className="auth-divider">o</div>

        <Button variant="secondary" block onClick={() => void onGoogle()} disabled={!configured}>
          Continuar con Google
        </Button>

        <div className="auth-footer">
          <Link to="/auth/recuperar">¿Olvidaste tu contraseña?</Link>
          <br />
          ¿No tienes cuenta? <Link to="/auth/registro">Regístrate</Link>
          <br />
          <Link to="/privacidad">Privacidad</Link>
        </div>
      </div>
    </div>
  )
}
