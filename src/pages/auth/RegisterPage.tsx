import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Input } from '@/components/ui/Input'
import { authErrorMessage } from '@/lib/authErrors'

export function RegisterPage() {
  const { signUp, session, loading, configured } = useAuth()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setInfo(null)

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      setSubmitting(false)
      return
    }

    const { error: err, session: createdSession } = await signUp({
      email,
      password,
      displayName,
    })
    setSubmitting(false)
    if (err) {
      setError(authErrorMessage(err))
      return
    }
    if (!createdSession) {
      setInfo(
        'Cuenta creada, pero aún no hay sesión. Revisa tu correo para confirmarla, o desactiva “Confirm email” en Supabase → Authentication → Providers → Email.',
      )
      return
    }
    navigate('/')
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">ControlaTusFinanzas</div>
          <p>Crea tu espacio personal gratuito. Sin paywalls.</p>
        </div>

        <ErrorBanner message={error} />
        <ErrorBanner message={info} tone="success" />

        <form className="auth-form" onSubmit={(e) => void onSubmit(e)}>
          <Input
            label="Nombre"
            name="displayName"
            autoComplete="name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
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
            autoComplete="new-password"
            required
            hint="Mínimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" block disabled={submitting || !configured}>
            {submitting ? 'Creando…' : 'Crear cuenta'}
          </Button>
        </form>

        <div className="auth-footer">
          ¿Ya tienes cuenta? <Link to="/auth/login">Entrar</Link>
          <br />
          <Link to="/privacidad">Privacidad</Link>
        </div>
      </div>
    </div>
  )
}
