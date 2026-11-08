import type { SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  hint?: string
  error?: string
  options: { value: string; label: string; disabled?: boolean }[]
  placeholder?: string
  /** Keep label for a11y but hide it visually (compact toolbars). */
  hideLabel?: boolean
}

export function Select({
  label,
  hint,
  error,
  id,
  className = '',
  options,
  placeholder,
  hideLabel = false,
  ...rest
}: SelectProps) {
  const selectId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="field">
      <label className={`field-label${hideLabel ? ' sr-only' : ''}`} htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className={`select ${className}`.trim()}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
        {...rest}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && !error ? (
        <span id={`${selectId}-hint`} className="field-hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${selectId}-error`} className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  )
}
