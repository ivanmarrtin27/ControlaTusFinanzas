import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BackupPanel } from '@/components/BackupPanel'
import { DeleteAccountPanel } from '@/components/DeleteAccountPanel'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { useAuth } from '@/contexts/AuthContext'
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT,
  applyAccentWithHover,
  isAccentContrastRisky,
  isValidAccentHex,
  normalizeAccent,
} from '@/lib/accent'
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '@/lib/currency'
import { supabase } from '@/lib/supabase'
import { readZoomLockEnabled, setZoomLockEnabled } from '@/lib/zoomLock'

export function AjustesPage() {
  const { profile, user, signOut, configured, refreshProfile } = useAuth()
  const [accent, setAccent] = useState(normalizeAccent(profile?.accent_color))
  const [currency, setCurrency] = useState(profile?.currency ?? DEFAULT_CURRENCY)
  const [zoomLock, setZoomLock] = useState(() => readZoomLockEnabled())
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setAccent(normalizeAccent(profile?.accent_color))
    setCurrency(profile?.currency ?? DEFAULT_CURRENCY)
  }, [profile?.accent_color, profile?.currency])

  const contrastRisky = isValidAccentHex(accent) && isAccentContrastRisky(accent)

  function previewAccent(next: string) {
    setAccent(next)
    if (isValidAccentHex(next)) applyAccentWithHover(next)
  }

  async function handleSavePreferences() {
    setError(null)
    setMessage(null)

    if (!isValidAccentHex(accent)) {
      setError('El color debe ser un hex válido de 6 dígitos (p. ej. #1DB954).')
      return
    }

    const normalized = normalizeAccent(accent)

    if (!configured || !user) {
      applyAccentWithHover(normalized)
      setMessage('Preferencias aplicadas en este dispositivo (sin Supabase).')
      return
    }

    setSaving(true)
    const { error: saveError } = await supabase
      .from('profiles')
      .update({
        accent_color: normalized,
        currency,
      })
      .eq('id', user.id)

    if (saveError) {
      setError(saveError.message)
    } else {
      applyAccentWithHover(normalized)
      await refreshProfile()
      setMessage('Preferencias guardadas.')
    }
    setSaving(false)
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>Ajustes</h1>
        <p className="page-header-lead">Perfil, color de acento, moneda, copia de seguridad y PWA.</p>
      </header>

      <div className="stack-md" style={{ maxWidth: '36rem' }}>
        <Card accent>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Cuenta</h2>
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            {user?.email ?? 'Sesión local / sin configurar'}
          </p>
          <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
            Nombre: {profile?.display_name ?? '—'}
          </p>
        </Card>

        <Card>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Color de acento</h2>
          <p className="field-hint" style={{ marginBottom: '0.75rem' }}>
            El acento se aplica al instante en botones, FAB y estados activos (Green Deck).
          </p>

          <div className="accent-preview" aria-live="polite">
            <span className="accent-preview-swatch" style={{ background: normalizeAccent(accent) }} />
            <div className="accent-preview-meta">
              <strong>Vista previa</strong>
              <span className="mono muted">{normalizeAccent(accent)}</span>
            </div>
            <button type="button" className="btn btn-primary btn-sm accent-preview-btn">
              Botón
            </button>
            <span className="chip chip-active">Activo</span>
          </div>

          <div
            className="accent-presets"
            role="listbox"
            aria-label="Presets de color de acento"
          >
            {ACCENT_PRESETS.map((preset) => {
              const selected = normalizeAccent(accent) === normalizeAccent(preset.value)
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`accent-preset${selected ? ' accent-preset-active' : ''}`}
                  onClick={() => previewAccent(preset.value)}
                  title={preset.label}
                >
                  <span
                    className="accent-preset-dot"
                    style={{ background: preset.value }}
                    aria-hidden="true"
                  />
                  <span>{preset.label}</span>
                </button>
              )
            })}
          </div>

          <div className="accent-custom-row">
            <label className="field-label" htmlFor="custom-accent">
              Color personalizado
            </label>
            <div className="accent-custom-inputs">
              <input
                type="color"
                className="accent-color-input"
                value={isValidAccentHex(accent) ? normalizeAccent(accent) : DEFAULT_ACCENT}
                onChange={(e) => previewAccent(e.target.value.toUpperCase())}
                aria-label="Elegir color con el selector"
              />
              <input
                id="custom-accent"
                className="input"
                value={accent}
                onChange={(e) => previewAccent(e.target.value)}
                placeholder="#1DB954"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </div>

          {contrastRisky ? (
            <ErrorBanner
              tone="info"
              message="Este acento puede verse poco contrastado sobre el fondo oscuro o en texto de botones. Prueba un tono más claro o un preset."
            />
          ) : null}
        </Card>

        <Card>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Moneda</h2>
          <p className="field-hint" style={{ marginBottom: '0.75rem' }}>
            Por defecto EUR. Cambia el símbolo/formato de importes; no hay conversión entre
            monedas.
          </p>
          <label className="field-label" htmlFor="currency-select">
            Moneda de visualización
          </label>
          <select
            id="currency-select"
            className="select"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {CURRENCY_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
        </Card>

        <BackupPanel />

        <Card>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>App instalable (PWA)</h2>
          <p className="field-hint" style={{ margin: 0 }}>
            En el navegador móvil usa «Añadir a la pantalla de inicio» / Instalar. Los atajos del
            sistema abren registrar gasto (`/?quick=expense`) o ingreso (`/?quick=income`).
          </p>
        </Card>

        <Card>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Pantalla táctil</h2>
          <label className="settings-toggle" htmlFor="zoom-lock-toggle">
            <span>
              <span className="settings-toggle-title">Bloquear zoom</span>
              <span className="field-hint" style={{ display: 'block', marginTop: '0.25rem' }}>
                Evita zoom con pellizco o doble toque en iPhone/PWA. Útil para no mover la
                interfaz, pero puede limitar la accesibilidad.
              </span>
            </span>
            <input
              id="zoom-lock-toggle"
              type="checkbox"
              className="switch"
              role="switch"
              checked={zoomLock}
              aria-checked={zoomLock}
              onChange={(e) => {
                const next = e.target.checked
                setZoomLock(next)
                setZoomLockEnabled(next)
              }}
            />
          </label>
        </Card>

        <Card>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Privacidad</h2>
          <p className="field-hint" style={{ marginBottom: '0.75rem' }}>
            Consulta cómo tratamos tus datos y cómo eliminarlos.
          </p>
          <Link to="/privacidad" className="text-link">
            Ver política de privacidad
          </Link>
        </Card>

        <DeleteAccountPanel />

        <ErrorBanner message={error} />
        <ErrorBanner message={message} tone="success" />

        <Button block onClick={() => void handleSavePreferences()} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar preferencias'}
        </Button>

        <Button
          variant="secondary"
          block
          onClick={() => void signOut()}
          disabled={!configured}
          aria-label="Cerrar sesión"
        >
          Cerrar sesión
        </Button>
      </div>
    </main>
  )
}
