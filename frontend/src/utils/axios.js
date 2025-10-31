import axios from 'axios'
import API_CONFIG from '../config/api.config'
import { STORAGE_KEYS } from '../constants/app.constants'

const axiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT || 60000,
  headers: { 'Content-Type': 'application/json' },
  // withCredentials: true, // bật nếu backend dùng cookie
})

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response) {
      const { status } = error.response
      const isRefreshCall = originalRequest?.url?.includes('/api/auth/refresh')

      switch (status) {
        case 403: {
          if (error.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
            localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN)
            localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
            localStorage.removeItem(STORAGE_KEYS.USER_DATA)
            if (window.location.pathname !== '/email-verification-required') {
              window.location.replace('/email-verification-required')
            }
            return Promise.reject(error)
          }
          break
        }

        case 401: {
          if (!originalRequest?._retry && !isRefreshCall) {
            originalRequest._retry = true

            const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)
            if (refreshToken) {
              try {
                // gọi trực tiếp axios (không dùng axiosInstance) để tránh interceptor đệ quy
                const resp = await axios.post(
                  `${API_CONFIG.BASE_URL}/api/auth/refresh`,
                  { refreshToken } // 👈 đúng schema backend
                )

                // 👇 đúng chỗ lấy token theo backend của bạn
                const tokens = resp?.data?.data?.tokens
                const accessToken = tokens?.accessToken
                const newRefreshToken = tokens?.refreshToken

                if (accessToken) {
                  localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, accessToken)
                  if (newRefreshToken) {
                    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken)
                  }

                  originalRequest.headers = originalRequest.headers || {}
                  originalRequest.headers.Authorization = `Bearer ${accessToken}`
                  return axiosInstance(originalRequest)
                }
              } catch (refreshError) {
                console.error('Token refresh failed:', refreshError)
              }
            }
          }

          // logout khi không refresh được
          const wasLoggedIn =
            localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) ||
            localStorage.getItem(STORAGE_KEYS.USER_DATA)

          localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN)
          localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
          localStorage.removeItem(STORAGE_KEYS.USER_DATA)

          if (wasLoggedIn && window.location.pathname !== '/') {
            window.location.replace('/')
          }
          return Promise.reject(error)
        }

        default:
          break
      }
    }

    return Promise.reject(error)
  }
)

export default axiosInstance
