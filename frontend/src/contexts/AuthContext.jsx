import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../hooks/useToast'
import authService from '../services/authService'
import { STORAGE_KEYS, ROUTES } from '../constants/app.constants'
import { AuthContext } from './AuthContext.js'

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()
  const [fbPages, setFbPages] = useState(() => {

    try {
      //Lưu Page vào local
      const raw = localStorage.getItem(STORAGE_KEYS.FB_PAGES)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  //Lưu data Ad Account lấy được từ API FB vào local 
  const [fbAdAccounts, setFbAdAccounts] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.FB_AD_ACCOUNTS)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  // Đăng xuất
  const logout = useCallback((showToast = true) => {
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN)
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
    localStorage.removeItem(STORAGE_KEYS.USER_DATA)
    localStorage.removeItem(STORAGE_KEYS.FB_PAGES)
    setUser(null)
    setIsAuthenticated(false)
    setFbPages([])
    
    if (showToast) {
      toast.success('Đăng xuất thành công!')
    }
    // Chuyển trang về trang home sau khi đăng xuất
    setTimeout(() => {
      {
        navigate(ROUTES.HOME)
      }
    }, 2000)

  }, [navigate, toast])

  // Kiểm tra xác thực khi mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
        const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA)

        if (token && userData) {
          // Xác thực token vẫn hợp lệ bằng cách lấy user hiện tại
          try {
            const response = await authService.getCurrentUser()
            if (response.success) {
              setUser(response.data.user)
              setIsAuthenticated(true)
              // Khôi phục pages nếu có
              try {
                const rawPages = localStorage.getItem(STORAGE_KEYS.FB_PAGES)
                if (rawPages) setFbPages(JSON.parse(rawPages))
                const rawAdAccs = localStorage.getItem(STORAGE_KEYS.FB_AD_ACCOUNTS)
                if (rawAdAccs) setFbAdAccounts(JSON.parse(rawAdAccs))
              } catch { /* ignore invalid stored pages */ }
            } else {
              toast.warning(response.message || 'Có lỗi xảy ra khi truy xuất thông tin Trang', {
                duration: 4000
              })
              logout(false) // Đăng xuất im lặng trong quá trình xác thực token
            }
          } catch (error) {
            console.log('Token validation failed:', error)
            logout(false) // Đăng xuất im lặng trong quá trình xác thực token
          }
        }
      } catch (error) {
        console.log('Error checking auth:', error)
        logout(false) // Đăng xuất im lặng trong quá trình xác thực token
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [toast, logout])


  // Đăng nhập
  const login = async (credentials, redirectTo = null) => {
    try {
      setLoading(true)
      const response = await authService.login(credentials)

      if (response.success) {
        const { user, tokens, requiresEmailVerification } = response.data

        // Kiểm tra xem có cần xác nhận email không
        if (requiresEmailVerification || !user.emailVerified) {
          // Lưu thông tin user nhưng không lưu tokens
          localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user))
          setUser(user)
          setIsAuthenticated(false) // Không đăng nhập thực sự

          toast.warning(response.message || 'Vui lòng kiểm tra email để xác nhận tài khoản.', {
            duration: 5000
          })

          return {
            success: false,
            error: 'Email chưa được xác nhận',
            requiresEmailVerification: true,
            user
          }
        }

        // Lưu tokens và user data chỉ khi email đã được verify
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, tokens.accessToken)
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken)
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user))

        // Xóa danh sách page FB cũ nếu có (login thường)
        localStorage.removeItem(STORAGE_KEYS.FB_PAGES)
        setFbPages([])

        setUser(user)
        setIsAuthenticated(true)

        toast.success(response.message || 'Đăng nhập thành công!')

        // Chuyển trang sau khi login thành công: mặc định về Dashboard
        setTimeout(() => {
          if (redirectTo) {
            navigate(redirectTo)
          } else {
            navigate(ROUTES.DASHBOARD)
          }
        }, 1000)

        return { success: true, user }
      }
    } catch (error) {
      // Chỉ hiển thị message từ backend
      const errorMessage = error.response?.data?.message || error.message || 'Đăng nhập thất bại'
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }


  // Đăng ký
  const register = async (userData) => {
    try {
      setLoading(true)
      const response = await authService.register(userData)

      if (response.success) {
        toast.success(response.message || 'Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.', {
          duration: 5000
        })

        return { success: true, data: response.data }
      }
    } catch (error) {
      // Chỉ hiển thị message từ backend
      const errorMessage = error.response?.data?.message || error.message || 'Đăng ký thất bại'
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  // Hoàn tất đăng nhập từ kênh bên ngoài (ví dụ: Facebook)
  const completeExternalLogin = (data, redirectTo = null) => {
    const { user: loggedInUser, tokens, pages = [], adAccounts = [] } = data || {}
    if (!loggedInUser || !tokens?.accessToken || !tokens?.refreshToken) {
      toast.error('Thông tin đăng nhập không hợp lệ')
      return { success: false, error: 'invalid_external_login_payload' }
    }

    // Lưu tokens và user vào localStorage theo chuẩn của app
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, tokens.accessToken)
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken)
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(loggedInUser))
    localStorage.setItem(STORAGE_KEYS.FB_PAGES, JSON.stringify(pages))
    localStorage.setItem(STORAGE_KEYS.FB_AD_ACCOUNTS, JSON.stringify(adAccounts))

    // Cập nhật state để UI (avatar, xin chào, nav, ...) hiển thị ngay
    setUser(loggedInUser)
    setIsAuthenticated(true)
    setFbPages(pages)
    setFbAdAccounts(adAccounts)

    toast.success('Đăng nhập thành công!')

    // Điều hướng giống login thường
    setTimeout(() => {
      if (redirectTo) {
        navigate(redirectTo)
      } else {
        navigate(ROUTES.DASHBOARD)
      }
    }, 1000)

    return { success: true, user: loggedInUser }
  }

  // Quên mật khẩu
  const forgotPassword = async (email) => {
    try {
      setLoading(true)
      const response = await authService.forgotPassword(email)

      if (response.success) {
        toast.success(response.message || 'Email đặt lại mật khẩu đã được gửi!')
        return { success: true }
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Gửi email đặt lại mật khẩu thất bại'
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  //Đặt lại mật khẩu
  const resetPassword = async (token, password) => {
    try {
      setLoading(true)
      const response = await authService.resetPassword(token, password)

      if (response.success) {
        toast.success(response.message || 'Đặt lại mật khẩu thành công!')
        return { success: true }
      }
      setTimeout(() => {
        console.log('Navigating to:', ROUTES.HOME)
        navigate(ROUTES.HOME)
      }, 2000)
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Đặt lại mật khẩu thất bại'
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  // Chưa có backend
  const changePassword = async (currentPassword, newPassword) => {
    try {
      setLoading(true)
      const response = await authService.changePassword(currentPassword, newPassword)

      if (response.success) {
        toast.success(response.message || 'Đổi mật khẩu thành công')
        return { success: true }
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Đổi mật khẩu thất bại'
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  const resendVerificationEmail = async (email) => {
    try {
      setLoading(true)
      const response = await authService.resendVerificationEmail(email)

      if (response.success) {
        toast.success(response.message || 'Email xác nhận đã được gửi lại!')
        return { success: true }
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Gửi lại email xác nhận thất bại'
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  const updateUser = (newUserData) => {
    setUser(newUserData)
    if (newUserData) {
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(newUserData))
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER_DATA) // Xoá hẳn khi null
    }
  }

  const verifyEmail = async (token) => {
    try {
      setLoading(true)
      const response = await authService.verifyEmail(token)

      if (response.success) {
        toast.success(response.message || 'Xác nhận email thành công!')

        // Auto-login user after successful email verification
        if (response.data && response.data.user && response.data.tokens) {
          const { user, tokens } = response.data

          // Store tokens and user data (same as login)
          localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, tokens.accessToken)
          localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken)
          localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user))

          setUser(user)
          setIsAuthenticated(true)

        }

        // Chuyển trang về trang Dashboard sau khi xác nhận email thành công
        setTimeout(() => {
          navigate(ROUTES.DASHBOARD)
        }, 2000)

        return { success: true }
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Xác nhận email thất bại'
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  const value = {
    user,
    loading,
    isAuthenticated,
    fbPages,
    fbAdAccounts,
    login,
    completeExternalLogin,
    register,
    logout,
    updateUser,
    forgotPassword,
    resetPassword,
    changePassword,
    resendVerificationEmail,
    verifyEmail,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}