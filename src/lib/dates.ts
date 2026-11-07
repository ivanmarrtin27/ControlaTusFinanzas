/** Valor `YYYY-MM-DD` para inputs date (hora local). */
export function toDateInputValue(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return toDateInputValue(new Date())
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Convierte fecha de input a ISO al mediodía local (evita saltos de día por TZ). */
export function dateInputToIso(dateInput: string): string {
  const [y, m, d] = dateInput.split('-').map(Number)
  if (!y || !m || !d) return new Date().toISOString()
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString()
}

export function formatShortDate(iso: string, locale = 'es-ES'): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}
