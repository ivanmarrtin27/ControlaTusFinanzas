interface ErrorBannerProps {
  message?: string | null
  /** Visual tone; errors use alert, info/success use status */
  tone?: 'error' | 'info' | 'success'
}

export function ErrorBanner({ message, tone = 'error' }: ErrorBannerProps) {
  if (!message) return null

  const className =
    tone === 'success'
      ? 'auth-alert auth-success'
      : tone === 'info'
        ? 'auth-alert auth-info'
        : 'auth-alert'

  return (
    <div className={className} role={tone === 'error' ? 'alert' : 'status'}>
      {message}
    </div>
  )
}
