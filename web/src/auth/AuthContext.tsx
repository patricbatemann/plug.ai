import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, authApi, type User } from '../api/client'

interface AuthContextValue {
  user: User | null
  loading: boolean
  authCheckError: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)
const TOKEN_KEY = 'aienergy.accessToken'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authCheckError, setAuthCheckError] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setLoading(false)
      return
    }
    authApi
      .me(token)
      .then(setUser)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          localStorage.removeItem(TOKEN_KEY)
          return
        }
        setAuthCheckError('Could not verify your session. Check your connection and reload.')
      })
      .finally(() => setLoading(false))
  }, [])

  async function establishSession(operation: Promise<{ access_token: string; user: User }>) {
    const result = await operation
    localStorage.setItem(TOKEN_KEY, result.access_token)
    setUser(result.user)
    setAuthCheckError(null)
  }

  function signOut() {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      authCheckError,
      signIn: (email: string, password: string) =>
        establishSession(authApi.login(email, password)),
      signUp: (email: string, password: string) =>
        establishSession(authApi.register(email, password)),
      signOut,
    }),
    [user, loading, authCheckError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
