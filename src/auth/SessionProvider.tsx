import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface SessionState {
  session: Session | null
  isLoading: boolean
}

const SessionContext = createContext<SessionState>({ session: null, isLoading: true })

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, isLoading: true })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, isLoading: false }))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState({ session, isLoading: false }))
    return () => data.subscription.unsubscribe()
  }, [])

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>
}

export function useSession() {
  return useContext(SessionContext)
}

export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
}

export function sendMagicLink(email: string) {
  return supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
}

export function signOut() {
  return supabase.auth.signOut()
}
