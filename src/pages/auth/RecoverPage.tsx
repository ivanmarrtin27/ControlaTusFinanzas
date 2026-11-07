import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Input } from '@/components/ui/Input'
import { authErrorMessage } from '@/lib/authErrors'

export function RecoverPage() {
  const { resetPassword, configured } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setInfo(null)
    const { error: err } = await resetPassword(email)
    setSubmitting(false)
    if (err) {
      setError(authErrorMessage(err))
      return
    }
    setInfo('Si existe una cuenta con ese correo, recibirás un enlace de recuperación.')
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">ControlaTusFinanzas</div>
          <p>Recupera el acceso a tu cuenta.</p>
        </div>

        <ErrorBanner message={error} />
        <ErrorBanner message={info} tone="success" />

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
          <Button type="submit" block disabled={submitting || !configured}>
            {submitting ? 'Enviando…' : 'Enviar enlace'}
          </Button>
        </form>

        <div className="auth-footer">
          <Link to="/auth/login">Volver al inicio de sesión</Link>
        </div>
      </div>
    </div>
  )
}
