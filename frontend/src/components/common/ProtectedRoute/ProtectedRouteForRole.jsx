import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import { ROUTES } from '../../../constants/app.constants'
import './ProtectedRoute.css'

/**
 * ProtectedRoute với kiểm tra internal_role
 * @param {Object} props
 * @param {React.ReactNode} props.children - Component children
 * @param {string} props.allowedRole - Internal role được phép truy cập (ví dụ: "CS Staff")
 */
const ProtectedRouteForRole = ({ children, allowedRole }) => {
  const { isAuthenticated, loading, user } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="protected-route-loading">
        <div className="spinner"></div>
        <p>Đang kiểm tra xác thực...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    // Save the attempted location for redirecting after login
    return <Navigate to={ROUTES.HOME} state={{ from: location }} replace />
  }

  // Kiểm tra internal_role
  if (allowedRole && user?.internal_role !== allowedRole) {
    // User không có quyền truy cập
    return <Navigate to={ROUTES.HOME} replace />
  }

  return children
}

export default ProtectedRouteForRole

