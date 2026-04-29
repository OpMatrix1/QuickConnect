import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile, ProfileUpdate } from '@/lib/types'

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
}

interface AuthContextType extends AuthState {
  signUp: (email: string, password: string, fullName: string, role: 'customer' | 'provider', businessName?: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  forgotPassword: (email: string) => Promise<{ error: string | null }>
  /** Recovery / logged-out reset (email link session). Do not wrap in short timeouts — server can be slow. */
  updatePassword: (password: string) => Promise<{ error: string | null }>
  /** Change password while signed in; verifies current password first. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  updateProfile: (updates: ProfileUpdate) => Promise<{ error: string | null }>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const AUTH_TIMEOUT_MS = 12_000

function isAuthLockAcquireTimeout(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'isAcquireTimeout' in err &&
    (err as { isAcquireTimeout?: boolean }).isAcquireTimeout === true
  )
}

/** getSession can throw if the cross-tab auth lock times out — retry instead of treating as logged out. */
async function getSessionWithLockRetries(): Promise<
  Awaited<ReturnType<typeof supabase.auth.getSession>>
> {
  const delays = [0, 200, 400, 800]
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) {
      await new Promise((r) => setTimeout(r, delays[i]))
    }
    try {
      return await supabase.auth.getSession()
    } catch (err) {
      if (isAuthLockAcquireTimeout(err) && i < delays.length - 1) {
        continue
      }
      console.error('[auth] getSession threw', err)
      return { data: { session: null }, error: null }
    }
  }
  return { data: { session: null }, error: null }
}

function withTimeout<T>(promise: PromiseLike<T>, ms = AUTH_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out')), ms)
    Promise.resolve(promise).then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
  })

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', userId as never).single()
      )
      return data as Profile | null
    } catch {
      return null
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!state.user) return
    const profile = await fetchProfile(state.user.id)
    setState((prev) => ({ ...prev, profile }))
  }, [state.user, fetchProfile])

  const fetchProfileRef = useRef(fetchProfile)
  fetchProfileRef.current = fetchProfile

  useEffect(() => {
    let cancelled = false
    let subscription: { unsubscribe: () => void } | null = null

    const bootstrap = async () => {
      // Restore session from storage before any UI treats the user as logged out (full page refresh).
      try {
        const {
          data: { session },
          error,
        } = await getSessionWithLockRetries()
        if (cancelled) return

        if (error) {
          console.error('[auth] getSession', error)
          setState({ user: null, session: null, profile: null, loading: false })
        } else if (session?.user) {
          const profile = await fetchProfileRef.current(session.user.id)
          if (cancelled) return
          setState({ user: session.user, session, profile, loading: false })
        } else {
          setState({ user: null, session: null, profile: null, loading: false })
        }
      } catch {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false }))
        }
      }

      if (cancelled) return

      // IMPORTANT: Do not use an async callback here. GoTrue runs this inside an exclusive lock;
      // awaiting other Supabase calls (e.g. profile fetch) can deadlock and later surface as bogus sign-outs.
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (cancelled) return
        // Initial hydration is handled by getSession() above; this event can race with null session.
        if (event === 'INITIAL_SESSION') return

        if (event === 'SIGNED_OUT') {
          setState({ user: null, session: null, profile: null, loading: false })
          return
        }

        if (event === 'TOKEN_REFRESHED' && session?.user) {
          setState((prev) => ({
            ...prev,
            session,
            user: session.user,
            loading: false,
          }))
          return
        }

        if (!session?.user) {
          return
        }

        const userId = session.user.id
        queueMicrotask(() => {
          void fetchProfileRef.current(userId).then((profile) => {
            if (cancelled) return
            setState({ user: session.user, session, profile, loading: false })
          })
        })
      })
      subscription = data.subscription
    }

    void bootstrap()

    return () => {
      cancelled = true
      subscription?.unsubscribe()
    }
  }, [])

  const signUp = async (email: string, password: string, fullName: string, role: 'customer' | 'provider', businessName?: string) => {
    try {
      const basePath = import.meta.env.BASE_URL || '/'
      const emailRedirectTo = new URL(basePath, window.location.origin).toString()
      const { error } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, role, business_name: businessName || null },
            emailRedirectTo,
          },
        })
      )
      if (error) return { error: error.message }
      return { error: null }
    } catch (err) {
      if (err instanceof Error && err.message === 'Request timed out') {
        return { error: 'Request timed out. Please try again shortly.' }
      }
      return { error: 'Unable to connect to server. Please try again.' }
    }
  }

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password })
      )
      if (error) return { error: error.message }
      return { error: null }
    } catch (err) {
      if (err instanceof Error && err.message === 'Request timed out') {
        return { error: 'Request timed out. Please try again shortly.' }
      }
      return { error: 'Unable to connect to server. Please try again.' }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setState({ user: null, session: null, profile: null, loading: false })
  }

  const forgotPassword = async (email: string): Promise<{ error: string | null }> => {
    try {
      const basePath = import.meta.env.BASE_URL || '/'
      const redirectPath = `${basePath.endsWith('/') ? basePath.slice(0, -1) : basePath}/reset-password`
      const redirectTo = new URL(redirectPath, window.location.origin).toString()
      const { error } = await withTimeout(
        supabase.auth.resetPasswordForEmail(email, { redirectTo })
      )
      if (error) return { error: error.message }
      return { error: null }
    } catch (err) {
      if (err instanceof Error && err.message === 'Request timed out') {
        return { error: 'Request timed out. Please try again shortly.' }
      }
      return { error: 'Unable to connect to server. Please try again.' }
    }
  }

  const updatePassword = async (password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { error: error.message }
    return { error: null }
  }

  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ error: string | null }> => {
    const email = state.user?.email
    if (!email) return { error: 'Not signed in' }
    if (newPassword.length < 6) return { error: 'New password must be at least 6 characters' }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })
    if (signInError) {
      return { error: 'Current password is incorrect' }
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return { error: error.message }
    return { error: null }
  }

  const updateProfile = async (updates: ProfileUpdate) => {
    if (!state.user) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('profiles')
      .update(updates as never)
      .eq('id', state.user.id as never)
    if (error) return { error: error.message }
    await refreshProfile()
    return { error: null }
  }

  return (
    <AuthContext.Provider value={{ ...state, signUp, signIn, forgotPassword, updatePassword, changePassword, signOut, updateProfile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
