import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingBlock } from '@/components/ui'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="page-center">
        <LoadingBlock label="Verificando sesión JWT…" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

export function PublicOnlyRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="page-center">
        <LoadingBlock />
      </div>
    )
  }

  if (user) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

export function StaffRoute() {
  const { isStaff, loading } = useAuth()
  if (loading) {
    return (
      <div className="page-center">
        <LoadingBlock />
      </div>
    )
  }
  if (!isStaff) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
