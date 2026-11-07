import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

const CONFIRM_WORD = 'ELIMINAR'

export function DeleteAccountPanel() {
  const { user, configured, signOut } = useAuth()
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleDelete() {
    setError(null)
    if (!configured || !isSupabaseConfigured || !user) {
      setError('Necesitas sesión con Supabase para eliminar la cuenta.')
      return
    }
    if (confirm.trim().toUpperCase() !== CONFIRM_WORD) {
      setError(`Escribe ${CONFIRM_WORD} para confirmar.`)
      return
    }
    if (
      !window.confirm(
        'Se borrarán todos tus datos financieros y tu cuenta de acceso. ¿Continuar?',
      )
    ) {
      return
    }

    setBusy(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Sesión no válida. Vuelve a iniciar sesión.')

      const { data, error: fnError } = await supabase.functions.invoke('delete-account', {
        body: { confirm: CONFIRM_WORD },
      })

      if (fnError) throw new Error(fnError.message)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new Error(String(data.error))
      }

      setDone(true)
      await signOut()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar la cuenta. Revisa que la función delete-account esté desplegada.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <Card>
        <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Cuenta eliminada</h2>
        <p className="muted" style={{ margin: 0 }}>
          Tus datos se han borrado. Gracias por usar ControlaTusFinanzas.
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Eliminar cuenta</h2>
      <p className="field-hint" style={{ marginBottom: '0.75rem' }}>
        Borra de forma permanente tus datos en la app y tu usuario de acceso. Escribe{' '}
        <strong>{CONFIRM_WORD}</strong> para confirmar.
      </p>
      <Input
        label="Confirmación"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder={CONFIRM_WORD}
        autoComplete="off"
      />
      <ErrorBanner message={error} />
      <Button
        variant="destructive"
        onClick={() => void handleDelete()}
        disabled={busy || !configured}
        style={{ marginTop: '0.75rem' }}
      >
        {busy ? 'Eliminando…' : 'Eliminar mi cuenta'}
      </Button>
    </Card>
  )
}
