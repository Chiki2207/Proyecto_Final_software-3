import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getProfile, getUserRoles } from '@/services/fincomer'
import type { AppRoleCode, Profile, SignInPayload, SignUpPayload } from '@/types'

type AuthContextValue = {
  user: User | null
  session: Session | null
  profile: Profile | null
  roles: AppRoleCode[]
  loading: boolean
  accessToken: string | null
  isStaff: boolean
  isAdmin: boolean
  signUp: (payload: SignUpPayload) => Promise<{ error: string | null }>
  signIn: (payload: SignInPayload) => Promise<{ error: string | null; needsMfa?: boolean }>
  verifyMfa: (code: string) => Promise<{ error: string | null }>
  enrollMfa: () => Promise<{ qrCode: string; secret: string; factorId: string } | { error: string }>
  challengeAndVerifyMfa: (factorId: string, code: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [roles, setRoles] = useState<AppRoleCode[]>([])
  const [loading, setLoading] = useState(true)

  const loadExtras = useCallback(async (userId: string) => {
    try {
      const [p, r] = await Promise.all([getProfile(userId), getUserRoles(userId)])
      if (p.status !== 'active') {
        await supabase.auth.signOut()
        setProfile(null)
        setRoles([])
        return
      }
      setProfile(p)
      setRoles(r)
    } catch {
      setProfile(null)
      setRoles([])
    }
  }, [])

  useEffect(() => {
    let mounted = true

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      if (data.session?.user) await loadExtras(data.session.user.id)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setUser(next?.user ?? null)
      if (next?.user) {
        void loadExtras(next.user.id)
      } else {
        setProfile(null)
        setRoles([])
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadExtras])

  const signUp = useCallback(async (payload: SignUpPayload) => {
    const { error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          full_name: payload.fullName,
          document_number: payload.documentNumber,
          phone: payload.phone ?? null,
        },
      },
    })
    return { error: error?.message ?? null }
  }, [])

  const signIn = useCallback(async ({ email, password }: SignInPayload) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('banned') || msg.includes('disabled')) {
        return { error: 'Tu cuenta está desactivada o bloqueada. Contacta a Fincomer.' }
      }
      return { error: error.message }
    }

    if (data.user) {
      try {
        const profile = await getProfile(data.user.id)
        if (profile.status !== 'active') {
          await supabase.auth.signOut()
          const reason =
            profile.status === 'inactive'
              ? 'Tu cuenta fue dada de baja. No puedes ingresar.'
              : profile.status === 'blocked'
                ? 'Tu cuenta está bloqueada. Contacta a Fincomer.'
                : 'Tu cuenta aún no está activa.'
          return { error: reason }
        }
      } catch {
        await supabase.auth.signOut()
        return { error: 'No se pudo validar el estado de la cuenta.' }
      }
    }

    // Si hay factores MFA TOTP, exigir segundo factor (RF-03)
    const factors = await supabase.auth.mfa.listFactors()
    const totp = factors.data?.totp ?? []
    if (totp.length > 0) {
      return { error: null, needsMfa: true }
    }

    if (data.user) await loadExtras(data.user.id)
    return { error: null, needsMfa: false }
  }, [loadExtras])

  const verifyMfa = useCallback(async (code: string) => {
    const factors = await supabase.auth.mfa.listFactors()
    const factor = factors.data?.totp?.[0]
    if (!factor) return { error: 'No hay MFA configurado' }

    const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id })
    if (challenge.error) return { error: challenge.error.message }

    const verified = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.data.id,
      code,
    })
    if (verified.error) return { error: verified.error.message }
    return { error: null }
  }, [])

  const enrollMfa = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Fincomer Authenticator',
    })
    if (error || !data) return { error: error?.message ?? 'No se pudo iniciar MFA' }
    return {
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      factorId: data.id,
    }
  }, [])

  const challengeAndVerifyMfa = useCallback(async (factorId: string, code: string) => {
    const challenge = await supabase.auth.mfa.challenge({ factorId })
    if (challenge.error) return { error: challenge.error.message }

    const verified = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code,
    })
    if (verified.error) return { error: verified.error.message }

    if (user) {
      await supabase.from('profiles').update({ mfa_enabled: true }).eq('id', user.id)
      await loadExtras(user.id)
    }
    return { error: null }
  }, [user, loadExtras])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) await loadExtras(user.id)
  }, [user, loadExtras])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      roles,
      loading,
      accessToken: session?.access_token ?? null,
      isStaff: roles.some((r) => r === 'admin' || r === 'asesor' || r === 'riesgos'),
      isAdmin: roles.includes('admin'),
      signUp,
      signIn,
      verifyMfa,
      enrollMfa,
      challengeAndVerifyMfa,
      signOut,
      refreshProfile,
    }),
    [
      user,
      session,
      profile,
      roles,
      loading,
      signUp,
      signIn,
      verifyMfa,
      enrollMfa,
      challengeAndVerifyMfa,
      signOut,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
