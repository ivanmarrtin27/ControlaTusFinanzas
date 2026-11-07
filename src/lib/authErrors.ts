/** Traduce errores de Auth/Supabase a mensajes claros en español. */
export function authErrorMessage(err: unknown): string {
  if (!err) return 'Ha ocurrido un error desconocido.'

  const raw =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Ha ocurrido un error desconocido.'

  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : ''

  const lower = raw.toLowerCase()

  if (
    code === 'email_provider_disabled' ||
    lower.includes('email signups are disabled') ||
    lower.includes('email logins are disabled') ||
    lower.includes('email provider is disabled')
  ) {
    return 'El acceso por correo está desactivado en Supabase. Activa Authentication → Providers → Email (Enable Sign in with Email).'
  }

  if (
    code === 'over_email_send_rate_limit' ||
    lower.includes('email rate limit') ||
    lower.includes('over_email_send_rate_limit')
  ) {
    return 'Se ha superado el límite de correos de Supabase. Espera unos minutos o desactiva “Confirm email” en Providers → Email.'
  }

  if (
    code === 'email_address_invalid' ||
    (lower.includes('email address') && lower.includes('invalid'))
  ) {
    return 'Ese correo no es válido. Usa una dirección real (evita dominios de prueba como example.com).'
  }

  if (
    code === 'user_already_exists' ||
    lower.includes('already registered') ||
    lower.includes('user already registered') ||
    lower.includes('already been registered')
  ) {
    return 'Ya existe una cuenta con ese correo. Prueba a iniciar sesión.'
  }

  if (
    code === 'invalid_credentials' ||
    lower.includes('invalid login credentials') ||
    lower.includes('correo o contraseña incorrectos')
  ) {
    return 'Correo o contraseña incorrectos.'
  }

  if (code === 'email_not_confirmed' || lower.includes('email not confirmed')) {
    return 'Debes confirmar tu correo antes de entrar. Revisa la bandeja de entrada (y spam).'
  }

  if (lower.includes('password') && (lower.includes('weak') || lower.includes('at least'))) {
    return 'La contraseña no cumple los requisitos. Usa al menos 8 caracteres.'
  }

  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'No hay conexión con el servidor. Comprueba tu red e inténtalo de nuevo.'
  }

  return raw
}
