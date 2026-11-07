import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

const STORAGE_KEY = 'ctf_onboarding_tip_v1'

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function OnboardingTip() {
  const [dismissed, setDismissed] = useState(readDismissed)

  if (dismissed) return null

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    setDismissed(true)
  }

  return (
    <aside className="onboarding-tip" role="status">
      <div>
        <strong>Empieza en 3 pasos</strong>
        <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
          Crea una cuenta, registra un movimiento y, si quieres, exporta una copia JSON desde{' '}
          <Link to="/ajustes">Ajustes</Link>. También puedes instalar la app (PWA) desde el
          navegador.
        </p>
      </div>
      <Button size="sm" variant="secondary" onClick={dismiss}>
        Entendido
      </Button>
    </aside>
  )
}
