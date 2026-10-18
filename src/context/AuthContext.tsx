import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Session, User } from '@supabase/supabase-js'

export type Profile = {
  id: string
  display_name: string | null
  avatar_url: string | null
  email: string | null
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  isAdmin: boolean
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user?.id

  useEffect(() => {
    let mounted = true
    if (!userId) {
      setProfile(null)
      setIsAdmin(false)
      return
    }

    ;(async () => {
      const [profRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name, avatar_url, email').eq('id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId),
      ])
      if (!mounted) return
      setProfile((profRes.data as Profile) ?? null)
      setIsAdmin(rolesRes.data?.some((r) => r.role === 'admin') ?? false)
    })()

    return () => {
      mounted = false
    }
  }, [userId])

  const refreshProfile = async () => {
    if (!userId) return
    const profRes = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, email')
      .eq('id', userId)
      .maybeSingle()
    setProfile((profRes.data as Profile) ?? null)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setIsAdmin(false)
  }

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, profile, isAdmin, loading, refreshProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
