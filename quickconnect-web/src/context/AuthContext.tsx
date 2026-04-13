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
  signOut: () => Promise<void>
  updateProfile: (updates: ProfileUpdate) => Promise<{ error: string | null }>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const AUTH_TIMEOUT_MS = 12_000

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
        supabase.from('profiles').select('*').eq('id', userId).single()
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
    const timeout = setTimeout(() => {
      setState((prev) => prev.loading ? { ...prev, loading: false } : prev)
    }, 5000)

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(timeout)
      if (session?.user) {
        const profile = await fetchProfileRef.current(session.user.id)
        setState({ user: session.user, session, profile, loading: false })
      } else {
        setState({ user: null, session: null, profile: null, loading: false })
      }
    }).catch(() => {
      clearTimeout(timeout)
      setState({ user: null, session: null, profile: null, loading: false })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const profile = await fetchProfileRef.current(session.user.id)
          setState({ user: session.user, session, profile, loading: false })
        } else {
          setState({ user: null, session: null, profile: null, loading: false })
        }
      }
    )

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (email: string, password: string, fullName: string, role: 'customer' | 'provider', businessName?: string) => {
    try {
      const { error } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, role, business_name: businessName || null } },
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

  const updateProfile = async (updates: ProfileUpdate) => {
    if (!state.user) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', state.user.id)
    if (error) return { error: error.message }
    await refreshProfile()
    return { error: null }
  }

  return (
    <AuthContext.Provider value={{ ...state, signUp, signIn, signOut, updateProfile, refreshProfile }}>
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
