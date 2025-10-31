import { useContext } from 'react'
import { AuthContext } from '../contexts/AuthContext.js'

/**
 * Custom hook to use Auth context
 * Separated from AuthContext to avoid fast refresh issues
 */
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}