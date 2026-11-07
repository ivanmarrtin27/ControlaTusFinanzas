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
