/**
 * Auth de ControlaTusFinanzas (sesión + perfil + acento).
 *
 * Flujo normal: Auth nativo de Supabase (email/password u OAuth Google).
 * Fallback: Edge Function `auth-email` cuando el proveedor Email está
 * desactivado o no hay sesión tras signup (p. ej. confirm-email activo).
 * El acento se aplica al perfil y se cachea en localStorage para el first paint.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'
import { authErrorMessage } from '@/lib/authErrors'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'
import { applyAccentWithHover, DEFAULT_ACCENT, readStoredAccent } from '@/lib/accent'

type AuthEmailResponse = {
  session?: Session | null
  user?: User | null
  error?: string
  code?: string | null
}

/** Llama a la Edge Function y deja la sesión en el cliente con setSession. */
async function authEmailRequest(
  action: 'signup' | 'login',
  params: { email: string; password: string; displayName?: string },
): Promise<{ session: Session | null; error: Error | null }> {
  const { data, error } = await supabase.functions.invoke<AuthEmailResponse>('auth-email', {
    body: {
      action,
      email: params.email,
      password: params.password,
      display_name: params.displayName,
    },
  })

  let payload = data
  if (error) {
    // functions.invoke a veces oculta el JSON; intentamos leer el cuerpo.
    const ctx = error as AuthError & { context?: Response }
    let detail = error.message
    let code: string | undefined = error.name
    try {
      if (ctx.context) {
        const cloned = ctx.context.clone()
        const body = (await cloned.json()) as AuthEmailResponse
        if (body?.error) {
          detail = body.error
          code = body.code ?? code
          payload = body
        }
      }
    } catch {
      // ignore parse errors
    }
    if (!payload?.session) {
      return { session: null, error: new Error(authErrorMessage({ message: detail, code })) }
    }
  }

  if (payload?.error) {
    return {
      session: null,
      error: new Error(authErrorMessage({ message: payload.error, code: payload.code ?? undefined })),
    }
  }

  const session = payload?.session ?? null
  if (!session?.access_token || !session.refresh_token) {
    return { session: null, error: new Error('No se recibió una sesión válida del servidor.') }
  }

  const { error: setError } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
  if (setError) {
    return { session: null, error: new Error(authErrorMessage(setError)) }
  }

  return { session, error: null }
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  configured: boolean
  signUp: (params: {
    email: string
    password: string
    displayName: string
  }) => Promise<{ error: AuthError | Error | null; session: Session | null }>
  signIn: (params: {
    email: string
    password: string
  }) => Promise<{ error: AuthError | Error | null }>
  signInWithGoogle: () => Promise<{ error: AuthError | Error | null }>
  signOut: () => Promise<{ error: AuthError | Error | null }>
  resetPassword: (email: string) => Promise<{ error: AuthError | Error | null }>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) return null
  return (data as Profile | null) ?? null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  const refreshProfile = useCallback(async () => {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) {
      setProfile(null)
      return
    }
    const next = await fetchProfile(userId)
    setProfile(next)
    if (next?.accent_color) {
      applyAccentWithHover(next.accent_color)
    }
  }, [])

  useEffect(() => {
    applyAccentWithHover(readStoredAccent() || DEFAULT_ACCENT)

    if (!isSupabaseConfigured) {
      return
    }

    let mounted = true

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) {
        const next = await fetchProfile(data.session.user.id)
        if (!mounted) return
        setProfile(next)
        if (next?.accent_color) applyAccentWithHover(next.accent_color)
      }
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession?.user) {
        setProfile(null)
        return
      }
      void fetchProfile(nextSession.user.id).then((next) => {
        setProfile(next)
        if (next?.accent_color) applyAccentWithHover(next.accent_color)
      })
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signUp = useCallback(
    async ({
      email,
      password,
      displayName,
    }: {
      email: string
      password: string
      displayName: string
    }) => {
      if (!isSupabaseConfigured) {
        return {
          error: new Error('Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env'),
          session: null,
        }
      }

      // Preferir Auth nativo si el proveedor Email está activo.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: `${window.location.origin}/`,
        },
      })

      if (!error && data.session) {
        return { error: null, session: data.session }
      }

      const providerDisabled =
        !!error &&
        (error.code === 'email_provider_disabled' ||
          /email (signups|logins|provider).*disabled/i.test(error.message))

      // Fallback Edge Function: proveedor off, o signup sin sesión (confirm-email).
      if (providerDisabled) {
        return authEmailRequest('signup', { email, password, displayName })
      }
      if (!error && !data.session) {
        const issued = await authEmailRequest('login', { email, password })
        if (!issued.error) return issued
        return { error: null, session: null }
      }

      if (error) {
        return { error: new Error(authErrorMessage(error)), session: null }
      }
      return { error: null, session: null }
    },
    [],
  )

  const signIn = useCallback(async ({ email, password }: { email: string; password: string }) => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env') }
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) return { error: null }

    const providerDisabled =
      error.code === 'email_provider_disabled' ||
      /email (signups|logins|provider).*disabled/i.test(error.message)

    if (providerDisabled) {
      const fallback = await authEmailRequest('login', { email, password })
      return { error: fallback.error }
    }

    return { error: new Error(authErrorMessage(error)) }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env') }
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    })
    return { error: error ? new Error(authErrorMessage(error)) : null }
  }, [])

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase no está configurado') }
    }
    const { error } = await supabase.auth.signOut()
    return { error: error ? new Error(authErrorMessage(error)) : null }
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env') }
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/recuperar`,
    })
    return { error: error ? new Error(authErrorMessage(error)) : null }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      configured: isSupabaseConfigured,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      resetPassword,
      refreshProfile,
    }),
    [
      session,
      profile,
      loading,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      resetPassword,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return ctx
}
