/**
 * Application Constants
 * Centralized constants for the application
 */

// Layout constants
// export const LAYOUT = {
//   HEADER_HEIGHT: 100,
//   FOOTER_HEIGHT: 140,
//   SIDEBAR_WIDTH_EXPANDED: 240,
//   SIDEBAR_WIDTH_COLLAPSED: 60,
//   SCROLL_THRESHOLD: 5,
// }

// Timing constants
export const TIMING = {
  DEBOUNCE_DELAY: 300,
  LOADING_DELAY: 600,
  TOAST_DURATION: 3000,
  ANIMATION_DURATION: 200,
}

// Route paths
export const ROUTES = {
  HOME: '/',
  GUIDE: '/guide',
  DASHBOARD: '/dashboard',
  ACCOUNT_MANAGEMENT: '/account-management',
  ADS_MANAGEMENT: '/ads',
  ARCHIVE_ADS: '/archive-ads',
  CHAT_AI: '/chat-ai',
  ANALYTICS: '/analytics',
  REPORTS: '/reports',
  STATS: '/stats',
  PROFILE: '/profile',
  USER_TRANSACTION: '/user-transaction',
  SHOP: '/shop',
  SHOP_EMPLOYEE: '/shop/employee/:shopId',
  SHOP_HISTORY: '/shop/history/:shopId',
  CONNECT_PAGE: '/connect-page',
  CONNECT_AD_ACCOUNT: '/connect-ad-account',
  AUTOMATION_RULE: '/automation-rule',
  SERVICE_PACKAGE: '/service-package',
  ORDER: '/order',
  CHECKOUT: '/checkout',
  CHECKOUT_BANK: '/checkout/bank',
  VERIFY_EMAIL: '/verify-email/:token',
  RESET_PASSWORD: '/reset-password/:token',
  NOT_FOUND: '*',
  // Admin (tối thiểu dùng cho redirect System Admin)
  ADMIN_SYSTEM_ADMIN_USER_MANAGEMENT: '/admin/system-admin/user-management',
}

// Valid routes for header display
export const HEADER_ROUTES = [
  ROUTES.HOME,
  ROUTES.GUIDE,
  ROUTES.DASHBOARD,
  ROUTES.ACCOUNT_MANAGEMENT,
  ROUTES.ADS_MANAGEMENT,
  ROUTES.ARCHIVE_ADS,
  ROUTES.CHAT_AI,
  ROUTES.ANALYTICS,
  ROUTES.REPORTS,
  ROUTES.STATS,
  ROUTES.PROFILE,
  ROUTES.USER_TRANSACTION,
  ROUTES.SHOP,
  ROUTES.SHOP_EMPLOYEE,
  ROUTES.SHOP_HISTORY,
  ROUTES.AUTOMATION_RULE,
  ROUTES.SERVICE_PACKAGE,
  ROUTES.ORDER,
  ROUTES.CHECKOUT,
  ROUTES.CHECKOUT_BANK
]

// Auth modes
export const AUTH_MODES = {
  LOGIN: 'login',
  REGISTER: 'register',
  RESET: 'reset',
}

// Local storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  FB_PAGES: 'fb_pages',
  FB_AD_ACCOUNTS: 'fb_ad_accounts',
  THEME: 'theme',
}

// Auth status
export const AUTH_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BANNED: 'banned',
}

// API Response status
export const API_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
  LOADING: 'loading',
}

// Feature keys mapping to Vietnamese labels
export const FEATURE_LABELS_VI = {
  analytics_chat_ai: 'ChatBot AI',
  content_ai: 'AI tạo nội dung',
  ads_auto_run: 'Quảng cáo tự động',
}

//Feature keys mapping to Englisg labels
export const FEATURE_LABELS_EN = {
  analytics_chat_ai: 'ChatBot AI',
  content_ai: 'AI Generate',
  ads_auto_run: 'Auto Run Ads',
}

// Helper function to get Vietnamese label for feature
export const getFeatureLabel = (featureKey) => {
  return FEATURE_LABELS_VI[featureKey] || featureKey
}