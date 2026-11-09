const GITHUB_URL = 'https://github.com/ivanmarrtin27'
const PORTFOLIO_URL = 'https://ivanmartin.pages.dev'

type DeveloperCreditProps = {
  /** Compact line for auth footers */
  variant?: 'default' | 'compact'
  className?: string
}

export function DeveloperCredit({ variant = 'default', className }: DeveloperCreditProps) {
  const rootClass =
    variant === 'compact'
      ? `developer-credit developer-credit-compact${className ? ` ${className}` : ''}`
      : `developer-credit${className ? ` ${className}` : ''}`

  return (
    <p className={rootClass}>
      Desarrollado por{' '}
      <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
        Iván Martín Molina
      </a>
      <span className="developer-credit-sep" aria-hidden>
        ·
      </span>
      <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
        GitHub
      </a>
      <span className="developer-credit-sep" aria-hidden>
        ·
      </span>
      <a href={PORTFOLIO_URL} target="_blank" rel="noopener noreferrer">
        Web
      </a>
    </p>
  )
}
