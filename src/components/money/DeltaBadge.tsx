import {
  deltaToneClass,
  deltaVerb,
  formatDeltaAbsolute,
  formatDeltaArrow,
  formatDeltaPercent,
  type DeltaPolarity,
  type MoneyDelta,
} from '@/lib/delta'

type Props = {
  delta: MoneyDelta
  currency: string
  /** Texto de contexto, p. ej. «este mes» o «vs ayer». */
  label?: string
  polarity?: DeltaPolarity
  /** Compacto: solo flecha + % + €. */
  compact?: boolean
  className?: string
}

/**
 * Indicador reutilizable de variación (↑/↓, verde/rojo).
 * Polarity `wealth`: subir es bueno. `cost`: bajar es bueno (gastos).
 */
export function DeltaBadge({
  delta,
  currency,
  label,
  polarity = 'wealth',
  compact = false,
  className = '',
}: Props) {
  const tone = deltaToneClass(delta.direction, polarity)
  const arrow = formatDeltaArrow(delta.direction)
  const abs = formatDeltaAbsolute(delta.absolute, currency)
  const pct = formatDeltaPercent(delta.ratio)

  if (compact) {
    return (
      <span className={`delta-badge delta-badge-compact ${tone} ${className}`.trim()}>
        <span aria-hidden="true">{arrow}</span>
        <span>
          {abs}
          {delta.ratio != null ? ` · ${pct}` : ''}
        </span>
        {label ? <span className="delta-badge-label muted">{label}</span> : null}
      </span>
    )
  }

  const verb = deltaVerb(delta.direction)
  return (
    <p className={`delta-badge ${tone} ${className}`.trim()}>
      <span aria-hidden="true">{arrow}</span>{' '}
      <strong>
        {verb} {abs}
      </strong>
      {delta.ratio != null ? <span> ({pct})</span> : null}
      {label ? <span className="delta-badge-label muted"> {label}</span> : null}
    </p>
  )
}
