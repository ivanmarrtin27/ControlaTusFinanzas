interface ProgressBarProps {
  ratio: number
  tone?: 'accent' | 'warn' | 'danger' | 'success'
  label?: string
}

export function ProgressBar({ ratio, tone = 'accent', label }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)))
  return (
    <div className="progress-wrap" aria-label={label ?? `Progreso ${pct}%`}>
      <div className="progress-track">
        <div
          className={`progress-fill progress-fill-${tone}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      {label ? <span className="progress-label muted">{label}</span> : null}
    </div>
  )
}
