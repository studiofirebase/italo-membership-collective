import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '@/integrations/api/client'
import {
  getLocalAdminTestEmail,
  isLocalAdminTestEnabled,
  isLocalAdminTestSession,
  signInLocalAdminTest as authenticateLocalAdminTest,
  signOutLocalAdminTest,
} from '@/lib/localAdminTest'
import type { Session, User } from '@/integrations/api/client'

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
  isLocalAdminTest: boolean
  checkingAdminRole: boolean
  adminRoleError: boolean
  loading: boolean
  refreshProfile: () => Promise<void>
  signInLocalAdminTest: (email: string, password: string) => boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  isAdmin: false,
  isLocalAdminTest: false,
  checkingAdminRole: false,
  adminRoleError: false,
  loading: true,
  refreshProfile: async () => {},
  signInLocalAdminTest: () => false,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLocalAdminTest, setIsLocalAdminTest] = useState(isLocalAdminTestSession)
  const [checkingAdminRole, setCheckingAdminRole] = useState(false)
  const [adminRoleError, setAdminRoleError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLocalAdminTest) {
      setLoading(false)
      return
    }

    let mounted = true

    api.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: { subscription } } = api.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [isLocalAdminTest])

  const userId = session?.user?.id

  useEffect(() => {
    let mounted = true
    if (isLocalAdminTest || !userId) {
      setProfile(
        isLocalAdminTest
          ? { id: 'local-admin-test', display_name: 'Administrador local', avatar_url: null, email: getLocalAdminTestEmail() }
          : null,
      )
      setIsAdmin(isLocalAdminTest)
      setCheckingAdminRole(false)
      setAdminRoleError(false)
      return
    }

    setCheckingAdminRole(true)
    setAdminRoleError(false)
    ;(async () => {
      const [profileResult, rolesResult] = await Promise.all([
        api
          .from('profiles')
          .select('id, display_name, avatar_url, email')
          .eq('id', userId)
          .maybeSingle(),
        api.from('user_roles').select('role').eq('user_id', userId),
      ])
      if (profileResult.error) throw profileResult.error
      if (rolesResult.error) throw rolesResult.error
      if (!mounted) return
      setProfile((profileResult.data as Profile) ?? null)
      setIsAdmin(rolesResult.data.some((role) => role.role === 'admin'))
    })()
      .catch((error: unknown) => {
        console.error('Não foi possível verificar o papel administrativo.', error)
        if (!mounted) return
        setIsAdmin(false)
        setAdminRoleError(true)
      })
      .finally(() => {
        if (mounted) setCheckingAdminRole(false)
      })

    return () => {
      mounted = false
    }
  }, [userId, isLocalAdminTest])

  const refreshProfile = async () => {
    if (!userId || isLocalAdminTest) return
    const profRes = await api
      .from('profiles')
      .select('id, display_name, avatar_url, email')
      .eq('id', userId)
      .maybeSingle()
    setProfile((profRes.data as Profile) ?? null)
  }

  const signOut = async () => {
    if (isLocalAdminTest) {
      signOutLocalAdminTest()
      setIsLocalAdminTest(false)
      setProfile(null)
      setIsAdmin(false)
      return
    }
    await api.auth.signOut()
    setProfile(null)
    setIsAdmin(false)
  }

  const signInLocalAdminTest = (email: string, password: string) => {
    if (!authenticateLocalAdminTest(email, password)) return false
    setIsLocalAdminTest(true)
    return true
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        isAdmin,
        isLocalAdminTest,
        checkingAdminRole,
        adminRoleError,
        loading,
        refreshProfile,
        signInLocalAdminTest,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
