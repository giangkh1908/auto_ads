import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import { getDefaultAdminRoute } from '../../../constants/adminConstants'
import { ROUTES } from '../../../constants/app.constants'
import './ProtectedRoute.css'

/**
 * AdminRouteGuard - Chặn user có internal_role truy cập các route không phải admin
 * Chỉ cho phép truy cập: Home, Profile, và các route admin
 */
const AdminRouteGuard = ({ children }) => {
  const { user, loading } = useAuth()
  const location = useLocation()
  const pathname = location.pathname

  if (loading) {
    return (
      <div className="protected-route-loading">
        <div className="spinner"></div>
        <p>Đang kiểm tra xác thực...</p>
      </div>
    )
  }

  // Chỉ áp dụng cho user có internal_role
  if (!user?.internal_role) {
    return children
  }

  // Các route được phép cho user có internal_role
  const allowedRoutes = [
    ROUTES.HOME, // Home
    ROUTES.PROFILE, // Profile (bao gồm change password)
    '/verify-email', // Verify email (nếu có token)
    '/reset-password', // Reset password (nếu có token)
  ]

  // Kiểm tra nếu route bắt đầu bằng /admin -> cho phép
  const isAdminRoute = pathname.startsWith('/admin')
  
  // Kiểm tra nếu route là verify-email hoặc reset-password với token
  const isAuthRoute = pathname.startsWith('/verify-email/') || pathname.startsWith('/reset-password/')

  // Cho phép nếu:
  // 1. Route là admin route
  // 2. Route nằm trong danh sách allowedRoutes
  // 3. Route là auth route (verify-email, reset-password)
  const isAllowed = isAdminRoute || allowedRoutes.includes(pathname) || isAuthRoute

  if (!isAllowed) {
    // Redirect về admin route mặc định của role
    const defaultAdminRoute = getDefaultAdminRoute(user.internal_role)
    if (defaultAdminRoute) {
      return <Navigate to={defaultAdminRoute} replace />
    }
    // Nếu không có default route, redirect về Home
    return <Navigate to={ROUTES.HOME} replace />
  }

  return children
}

export default AdminRouteGuard

