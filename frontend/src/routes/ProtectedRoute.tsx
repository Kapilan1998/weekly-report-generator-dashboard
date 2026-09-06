import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import type { Role } from '../types/api'

/**
 * Gates routes on being signed in and, optionally, on a role.
 *
 * This is a UX convenience only — it decides what to render, not what is allowed. The
 * backend re-checks role and ownership on every request, so hiding a route here is never
 * the thing protecting the data.
 */
export function ProtectedRoute({ role }: { role?: Role }) {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    // Remember where they were headed so sign-in can return them there.
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (role && user?.role !== role) {
    return <Navigate to="/reports" replace />
  }

  return <Outlet />
}
