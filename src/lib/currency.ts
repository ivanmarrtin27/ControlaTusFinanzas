export const DEFAULT_CURRENCY = 'EUR'

export const CURRENCY_OPTIONS = [
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'USD', label: 'Dólar estadounidense ($)' },
  { code: 'GBP', label: 'Libra esterlina (£)' },
  { code: 'MXN', label: 'Peso mexicano ($)' },
  { code: 'ARS', label: 'Peso argentino ($)' },
  { code: 'COP', label: 'Peso colombiano ($)' },
  { code: 'CLP', label: 'Peso chileno ($)' },
  { code: 'CHF', label: 'Franco suizo (CHF)' },
] as const

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]['code'] | string

export function formatMoney(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale = 'es-ES',
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

/**
 * Parsea importes escritos por el usuario (ES/US):
 * `12,50` · `12.50` · `1.234,56` · `1,234.56` · `10 €`
 * Devuelve null si no es un número válido.
 */
export function parseUserAmount(raw: string): number | null {
  let s = raw.trim()
  if (!s) return null

  s = s.replace(/\s/g, '').replace(/€/g, '').replace(/EUR/gi, '')
  if (!s || s === '-' || s === '+' || s === ',' || s === '.') return null

  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    const parts = s.split(',')
    if (parts.length === 2 && (parts[1]?.length ?? 0) <= 2) {
      s = `${parts[0]?.replace(/\./g, '') ?? ''}.${parts[1]}`
    } else {
      s = s.replace(/,/g, '')
    }
  }

  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return n
}
