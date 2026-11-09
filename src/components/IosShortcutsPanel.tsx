import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/contexts/ToastContext'
import { quickAddUrls } from '@/lib/quickAdd'

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.left = '-9999px'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

export function IosShortcutsPanel() {
  const toast = useToast()
  const urls = useMemo(() => quickAddUrls(), [])
  const [busy, setBusy] = useState<'expense' | 'income' | null>(null)

  async function handleCopy(kind: 'expense' | 'income') {
    setBusy(kind)
    const url = kind === 'expense' ? urls.expense : urls.income
    const ok = await copyText(url)
    setBusy(null)
    if (ok) {
      toast.success(kind === 'expense' ? 'Enlace de gasto copiado' : 'Enlace de ingreso copiado')
    } else {
      toast.error('No se pudo copiar. Selecciona el enlace manualmente.')
    }
  }

  return (
    <Card>
      <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
        Centro de control / Atajos iPhone
      </h2>
      <p className="field-hint" style={{ marginTop: 0 }}>
        Una PWA no puede añadir botones nativos al Centro de control. Crea un Atajo que abra
        estos enlaces y añádelo al Centro de control (iOS 18+).
      </p>

      <ol className="settings-steps">
        <li>
          Abre la app <strong>Atajos</strong> y crea un atajo nuevo (uno para gasto y otro para
          ingreso).
        </li>
        <li>
          Añade la acción <strong>Abrir URL</strong> y pega el enlace correspondiente (botones de
          abajo).
        </li>
        <li>
          Guarda el atajo con un nombre claro, p. ej. «Gasto CTF» o «Ingreso CTF».
        </li>
        <li>
          En el iPhone: Centro de control → <strong>Personalizar controles</strong> → añade{' '}
          <strong>Atajo</strong> y elige el que acabas de crear.
        </li>
        <li>
          Al tocarlo se abre la app (o Safari) con el formulario de gasto o ingreso listo.
        </li>
      </ol>

      <div className="settings-shortcut-links">
        <div className="settings-shortcut-row">
          <div className="settings-shortcut-meta">
            <strong>Gasto / pérdida</strong>
            <code className="mono settings-shortcut-url">{urls.expense}</code>
          </div>
          <div className="settings-shortcut-actions">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy === 'expense'}
              onClick={() => void handleCopy('expense')}
            >
              {busy === 'expense' ? 'Copiando…' : 'Copiar enlace'}
            </Button>
            <a className="btn btn-ghost btn-sm" href={urls.expense}>
              Abrir enlace de gasto
            </a>
          </div>
        </div>

        <div className="settings-shortcut-row">
          <div className="settings-shortcut-meta">
            <strong>Ingreso</strong>
            <code className="mono settings-shortcut-url">{urls.income}</code>
          </div>
          <div className="settings-shortcut-actions">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy === 'income'}
              onClick={() => void handleCopy('income')}
            >
              {busy === 'income' ? 'Copiando…' : 'Copiar enlace'}
            </Button>
            <a className="btn btn-ghost btn-sm" href={urls.income}>
              Abrir enlace de ingreso
            </a>
          </div>
        </div>
      </div>

      <p className="field-hint" style={{ marginBottom: 0, marginTop: '0.85rem' }}>
        Extra: si instalas la PWA en la pantalla de inicio, mantén pulsado el icono para ver los
        atajos «Gasto» e «Ingreso» (según el sistema).
      </p>
    </Card>
  )
}
