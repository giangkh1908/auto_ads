/**
 * API Configuration
 * Centralized API configuration for the application
 */

const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || "http://localhost:5001",
  API_PREFIX: "/api",
  AUTH_PREFIX: "/api/auth",
  TIMEOUT: 70000, // 70 seconds
};

export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    LOGIN: `${API_CONFIG.BASE_URL}${API_CONFIG.AUTH_PREFIX}/login`,
    REGISTER: `${API_CONFIG.BASE_URL}${API_CONFIG.AUTH_PREFIX}/register`,
    LOGOUT: `${API_CONFIG.BASE_URL}${API_CONFIG.AUTH_PREFIX}/logout`,
    FACEBOOK_LOGIN: `${API_CONFIG.BASE_URL}${API_CONFIG.AUTH_PREFIX}/facebook`,
    VERIFY_EMAIL: (token) =>
      `${API_CONFIG.BASE_URL}${API_CONFIG.AUTH_PREFIX}/verify-email/${token}`,
    RESEND_VERIFICATION: `${API_CONFIG.BASE_URL}${API_CONFIG.AUTH_PREFIX}/resend-verification`,
    FORGOT_PASSWORD: `${API_CONFIG.BASE_URL}${API_CONFIG.AUTH_PREFIX}/forgot-password`,
    RESET_PASSWORD: (token) =>
      `${API_CONFIG.BASE_URL}${API_CONFIG.AUTH_PREFIX}/reset-password/${token}`,
    ME: `${API_CONFIG.BASE_URL}${API_CONFIG.AUTH_PREFIX}/me`,
    REFRESH_TOKEN: `${API_CONFIG.BASE_URL}${API_CONFIG.AUTH_PREFIX}/refresh`,
    CHANGE_PASSWORD: `${API_CONFIG.BASE_URL}/api/auth/change-password`, // Cái này chưa có backend
  },

  USERS: {
    LIST: `${API_CONFIG.BASE_URL}/api/users`,
    DETAIL: (id) => `${API_CONFIG.BASE_URL}/api/users/${id}`,
    CREATE: `${API_CONFIG.BASE_URL}/api/users`,
    UPDATE: (id) => `${API_CONFIG.BASE_URL}/api/users/${id}`,
    DELETE: (id) => `${API_CONFIG.BASE_URL}/api/users/${id}`,
  },

  ROLES: {
    LIST: `${API_CONFIG.BASE_URL}/api/roles`,
    DETAIL: (id) => `${API_CONFIG.BASE_URL}/api/roles/${id}`,
    CREATE: `${API_CONFIG.BASE_URL}/api/roles`,
    UPDATE: (id) => `${API_CONFIG.BASE_URL}/api/roles/${id}`,
    DELETE: (id) => `${API_CONFIG.BASE_URL}/api/roles/${id}`,
    PERMISSIONS: (id) => `${API_CONFIG.BASE_URL}/api/roles/${id}/permissions`,
  },

  USER_ROLES: {
    LIST: `${API_CONFIG.BASE_URL}/api/user-roles`,
    ASSIGN: `${API_CONFIG.BASE_URL}/api/user-roles`,
    DETAIL: (id) => `${API_CONFIG.BASE_URL}/api/user-roles/${id}`,
    UPDATE: (id) => `${API_CONFIG.BASE_URL}/api/user-roles/${id}`,
    DELETE: (id) => `${API_CONFIG.BASE_URL}/api/user-roles/${id}`,
    BY_USER: (userId) => `${API_CONFIG.BASE_URL}/api/user-roles/user/${userId}`,
  },

  SHOPS: {
    LIST: `${API_CONFIG.BASE_URL}/api/shops`,
    MY_SHOPS: `${API_CONFIG.BASE_URL}/api/shops/my-shops`,
    DETAIL: (id) => `${API_CONFIG.BASE_URL}/api/shops/${id}`,
    CREATE: `${API_CONFIG.BASE_URL}/api/shops`,
    UPDATE: (id) => `${API_CONFIG.BASE_URL}/api/shops/${id}`,
    DELETE: (id) => `${API_CONFIG.BASE_URL}/api/shops/${id}`,
  },

  SHOP_FACEBOOK: {
    PAGES: `${API_CONFIG.BASE_URL}/api/shops/facebook/pages`,
    CONNECT: `${API_CONFIG.BASE_URL}/api/shops/facebook/connect`,
    DISCONNECT: `${API_CONFIG.BASE_URL}/api/shops/facebook/disconnect`,
    REFRESH_TOKEN: `${API_CONFIG.BASE_URL}/api/shops/facebook/refresh-token`,
  },

  SHOP_USERS: {
    LIST: `${API_CONFIG.BASE_URL}/api/shop-users`,
    DETAIL: (id) => `${API_CONFIG.BASE_URL}/api/shop-users/${id}`,
    CREATE: `${API_CONFIG.BASE_URL}/api/shop-users`,
    UPDATE: (id) => `${API_CONFIG.BASE_URL}/api/shop-users/${id}`,
    DELETE: (id) => `${API_CONFIG.BASE_URL}/api/shop-users/${id}`,
  },

  CAMPAIGNS: {
    LIST: `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/campaigns`,
    CREATE: `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/campaigns`,
    DETAIL: (id) =>
      `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/campaigns/${id}`,
    UPDATE: (id) =>
      `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/campaigns/${id}`,
    DELETE: (id, token) =>
      `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/campaigns/${id}${
        token ? `?access_token=${token}` : ""
      }`,
    SYNC: (accountId, token) =>
      `${API_CONFIG.BASE_URL}${
        API_CONFIG.API_PREFIX
      }/campaigns/sync?account_id=${accountId}${
        token ? `&access_token=${token}` : ""
      }`,
  },

  ADSETS: {
    LIST: `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/adsets`,
    DETAIL: (id) =>
      `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/adsets/${id}`,
    UPDATE: (id) =>
      `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/adsets/${id}`,
    DELETE: (id, token) =>
      `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/adsets/${id}${
        token ? `?access_token=${token}` : ""
      }`,
    SYNC: (accountId, token) =>
      `${API_CONFIG.BASE_URL}${
        API_CONFIG.API_PREFIX
      }/adsets/sync?account_id=${accountId}${
        token ? `&access_token=${token}` : ""
      }`,
  },

  ADS: {
    LIST: `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/ads`,
    DETAIL: (id) => `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/ads/${id}`,
    UPDATE: (id) => `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/ads/${id}`,
    DELETE: (id, token) =>
      `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/ads/${id}${
        token ? `?access_token=${token}` : ""
      }`,
    SYNC: (accountId, token) =>
      `${API_CONFIG.BASE_URL}${
        API_CONFIG.API_PREFIX
      }/ads/sync?account_id=${accountId}${
        token ? `&access_token=${token}` : ""
      }`,
    STATUS: `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/ads/status`,
  },
};

export default API_CONFIG;
