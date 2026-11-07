import { ErrorBanner } from '@/components/ui/ErrorBanner'

interface ConfigBannerProps {
  configured: boolean
  error?: string | null
}

export function ConfigBanner({ configured, error }: ConfigBannerProps) {
  if (!configured) {
    return (
      <ErrorBanner
        tone="info"
        message="Supabase no está configurado. Añade VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env (o en Vercel) y reinicia."
      />
    )
  }

  return <ErrorBanner message={error} />
}
