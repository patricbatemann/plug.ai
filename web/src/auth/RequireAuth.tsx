import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { InlineLoading, InlineNotification } from '@carbon/react'
import { useAuth } from './AuthContext'

export function RequireAuth() {
  const { user, loading, authCheckError } = useAuth()
  const location = useLocation()

  if (loading) return <div className="page-state"><InlineLoading description="Checking your session…" /></div>
  if (user) return <Outlet />
  if (authCheckError) {
    return (
      <div className="page-state">
        <InlineNotification kind="error" title="Session check failed" subtitle={authCheckError} hideCloseButton lowContrast />
      </div>
    )
  }
  return <Navigate to="/login" replace state={{ from: location }} />
}
