import { toast } from 'sonner'

// Global object để track toast times - không bị reset khi component re-render
const toastTracker = {}

/**
 * Custom debounced toast functions để tránh spam toast
 */
const debouncedToast = {
  success: (message, options = {}) => {
    const key = `success-${message}`
    const now = Date.now()
    
    if (toastTracker[key] && (now - toastTracker[key]) < 1500) {
      return // Block nếu toast giống nhau trong 1.5 giây
    }
    
    toastTracker[key] = now
    return toast.success(message, options)
  },
  
  error: (message, options = {}) => {
    const key = `error-${message}`
    const now = Date.now()
    
    if (toastTracker[key] && (now - toastTracker[key]) < 1500) {
      return // Block nếu toast giống nhau trong 1.5 giây
    }
    
    toastTracker[key] = now
    return toast.error(message, options)
  },
  
  warning: (message, options = {}) => {
    const key = `warning-${message}`
    const now = Date.now()
    
    if (toastTracker[key] && (now - toastTracker[key]) < 1500) {
      return // Block nếu toast giống nhau trong 1.5 giây
    }
    
    toastTracker[key] = now
    return toast.warning(message, options)
  },
  
  info: (message, options = {}) => {
    const key = `info-${message}`
    const now = Date.now()
    
    if (toastTracker[key] && (now - toastTracker[key]) < 1500) {
      return // Block nếu toast giống nhau trong 1.5 giây
    }
    
    toastTracker[key] = now
    return toast.info(message, options)
  }
}

/**
 * Custom hook trả về debounced toast functions
 */
export const useToast = () => {
  return debouncedToast
}
