/**
 * UI de Ajustes → Copia de seguridad.
 * Export descarga JSON; import exige escribir «SUSTITUIR» antes del replace.
 */
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { useAuth } from '@/contexts/AuthContext'
import {
  BACKUP_SCHEMA_VERSION,
  exportUserBackup,
  importUserBackup,
  parseAndValidateBackup,
  summarizeBackup,
  type BackupPayload,
} from '@/lib/backup'
import { applyAccentWithHover } from '@/lib/accent'
import { MoneyApiError } from '@/lib/moneyApi'

/** Palabra de confirmación obligatoria antes de sustituir datos. */
const CONFIRM_WORD = 'SUSTITUIR'

export function BackupPanel() {
  const { user, profile, configured, refreshProfile } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<BackupPayload | null>(null)
  const [confirmText, setConfirmText] = useState('')

  const canUse = configured && Boolean(user)

  async function handleExport() {
    if (!user) return
    setBusy('export')
    setError(null)
    setMessage(null)
    try {
      const payload = await exportUserBackup(user.id, profile)
      setMessage(`Copia descargada (v${payload.version}). ${summarizeBackup(payload)}.`)
    } catch (err) {
      setError(err instanceof MoneyApiError || err instanceof Error ? err.message : 'Error al exportar.')
    } finally {
      setBusy(null)
    }
  }

  async function handleFileChosen(file: File | null) {
    setError(null)
    setMessage(null)
    setPending(null)
    setConfirmText('')
    if (!file) return

    try {
      const text = await file.text()
      const raw: unknown = JSON.parse(text)
      const backup = parseAndValidateBackup(raw)
      setPending(backup)
      setMessage(`Archivo listo: ${summarizeBackup(backup)}. Revisa la advertencia antes de continuar.`)
    } catch (err) {
      setError(
        err instanceof MoneyApiError || err instanceof Error
          ? err.message
          : 'No se pudo leer el JSON.',
      )
    }
  }

  async function handleImportConfirm() {
    if (!user || !pending) return
    if (confirmText.trim().toUpperCase() !== CONFIRM_WORD) {
      setError(`Escribe ${CONFIRM_WORD} para confirmar la sustitución.`)
      return
    }

    setBusy('import')
    setError(null)
    setMessage(null)
    try {
      const mode = await importUserBackup(user.id, pending)
      await refreshProfile()
      if (pending.profile?.accent_color) {
        applyAccentWithHover(pending.profile.accent_color)
      }
      setPending(null)
      setConfirmText('')
      if (fileRef.current) fileRef.current.value = ''
      setMessage(
        mode === 'rpc'
          ? 'Importación completada (sustitución atómica). Recarga las pantallas si no ves los datos nuevos.'
          : 'Importación completada (modo cliente). Aplica la migración replace_user_backup para importaciones atómicas. Recarga si hace falta.',
      )
    } catch (err) {
      setError(err instanceof MoneyApiError || err instanceof Error ? err.message : 'Error al importar.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Copia de seguridad</h2>
      <p className="field-hint" style={{ marginBottom: '0.75rem' }}>
        Exporta o restaura un JSON versionado (v{BACKUP_SCHEMA_VERSION}) con cuentas, categorías,
        movimientos, transferencias, presupuestos, recurrentes, objetivos, aportaciones, deudas,
        etiquetas, plantillas rápidas y preferencias de perfil. No incluye contraseñas ni sesión.
        Las fotos de tickets no van en el JSON (solo la ruta `receipt_path` si existe); hay que
        volver a adjuntarlas tras importar. Las copias v1/v2 siguen siendo importables.
      </p>

      {!canUse ? (
        <div style={{ marginBottom: '0.75rem' }}>
          <ErrorBanner
            tone="info"
            message="Exportar e importar requieren sesión con Supabase configurado."
          />
        </div>
      ) : null}

      <div className="header-actions" style={{ marginBottom: '0.75rem' }}>
        <Button onClick={() => void handleExport()} disabled={!canUse || busy !== null}>
          {busy === 'export' ? 'Exportando…' : 'Exportar JSON'}
        </Button>
        <Button
          variant="secondary"
          disabled={!canUse || busy !== null}
          onClick={() => fileRef.current?.click()}
        >
          Elegir archivo…
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => void handleFileChosen(e.target.files?.[0] ?? null)}
        />
      </div>

      {pending ? (
        <div className="backup-import-warn" role="alert">
          <p style={{ margin: 0, fontWeight: 600 }}>Esta importación sustituye tus datos actuales</p>
          <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
            Se borrarán las filas de las entidades incluidas en la copia y se insertarán las del
            archivo (estrategia <strong>replace</strong>, no merge). El perfil se actualiza; no se
            elimina la cuenta. Exporta antes si quieres conservar lo que hay ahora.
          </p>
          <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
            Resumen: {summarizeBackup(pending)}
          </p>
          <label className="field-label" htmlFor="backup-confirm" style={{ marginTop: '0.75rem' }}>
            Escribe {CONFIRM_WORD} para confirmar
          </label>
          <input
            id="backup-confirm"
            className="input"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
            placeholder={CONFIRM_WORD}
            disabled={busy === 'import'}
          />
          <div className="header-actions" style={{ marginTop: '0.75rem' }}>
            <Button
              variant="destructive"
              disabled={busy !== null || confirmText.trim().toUpperCase() !== CONFIRM_WORD}
              onClick={() => void handleImportConfirm()}
            >
              {busy === 'import' ? 'Importando…' : 'Sustituir e importar'}
            </Button>
            <Button
              variant="ghost"
              disabled={busy !== null}
              onClick={() => {
                setPending(null)
                setConfirmText('')
                if (fileRef.current) fileRef.current.value = ''
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
        <ErrorBanner message={error} />
        <ErrorBanner message={message} tone="success" />
      </div>
    </Card>
  )
}
