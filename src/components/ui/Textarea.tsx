import type { TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  hint?: string
  error?: string
}

export function Textarea({ label, hint, error, id, className = '', ...rest }: TextareaProps) {
  const areaId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="field">
      <label className="field-label" htmlFor={areaId}>
        {label}
      </label>
      <textarea
        id={areaId}
        className={`input textarea ${className}`.trim()}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${areaId}-error` : hint ? `${areaId}-hint` : undefined}
        rows={3}
        {...rest}
      />
      {hint && !error ? (
        <span id={`${areaId}-hint`} className="field-hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${areaId}-error`} className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  )
}
