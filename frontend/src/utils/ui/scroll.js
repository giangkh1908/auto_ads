import { useEffect } from 'react'

/**
 * Cuộn lên đầu trang
 * @param {boolean} smooth - Có hiệu ứng mượt hay không (mặc định: true)
 */
export const scrollToTop = (smooth = true) => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: smooth ? 'smooth' : 'instant'
  })
}

/**
 * Cuộn đến vị trí cụ thể
 * @param {number} top - Vị trí Y
 * @param {boolean} smooth - Có hiệu ứng mượt hay không
 */
export const scrollTo = (top, smooth = true) => {
  window.scrollTo({
    top,
    left: 0,
    behavior: smooth ? 'smooth' : 'instant'
  })
}

/**
 * Cuộn đến element
 * @param {string|HTMLElement} element - Selector hoặc element
 * @param {string} block - Vị trí: 'start', 'center', 'end' (mặc định: 'start')
 */
export const scrollToElement = (element, block = 'start') => {
  const el = typeof element === 'string' ? document.querySelector(element) : element
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block })
  }
}

/**
 * Hook tự động cuộn lên đầu trang
 * @param {Array} deps - Dependencies (mặc định: [] - chỉ chạy khi mount)
 * @param {boolean} smooth - Có hiệu ứng mượt hay không
 */
export const useScrollToTop = (deps = [], smooth = true) => {
  useEffect(() => {
    scrollToTop(smooth)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}