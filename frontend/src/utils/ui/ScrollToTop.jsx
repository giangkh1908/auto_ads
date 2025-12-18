import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Component tự động cuộn lên đầu trang khi route thay đổi
 * Dùng với React Router
 */
function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant' // Dùng instant cho route change để UX tốt hơn
    })
  }, [pathname])

  return null
}

export default ScrollToTop