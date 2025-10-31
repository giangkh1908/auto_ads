import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import { ROUTES } from '../../../constants/app.constants'
import './ProtectedRoute.css'

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
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

  return children
}

export default ProtectedRoute