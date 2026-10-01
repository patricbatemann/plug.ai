import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function RequireAuth() {
  const { user, loading, authCheckError } = useAuth()
  const location = useLocation()

  if (loading) return <div className="page-state">Checking your session…</div>
  if (user) return <Outlet />
  if (authCheckError) return <div className="page-state form-error" role="alert">{authCheckError}</div>
  return <Navigate to="/login" replace state={{ from: location }} />
}
