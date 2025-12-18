import axiosInstance from "../../utils/api/axios";
import { API_ENDPOINTS } from "../../config/api.config";

/**
 * Authentication Service
 * Handles all auth-related API calls
 */
class AuthService {
  /**
   * Login user
   */
  async login(credentials) {
    try {
      const response = await axiosInstance.post(
        API_ENDPOINTS.AUTH.LOGIN,
        credentials
      );
      const data = response.data;

      // 🧩 Lưu token & user vào localStorage
      if (data?.data?.tokens?.accessToken) {
        localStorage.setItem("accessToken", data.data.tokens.accessToken);
        localStorage.setItem("refreshToken", data.data.tokens.refreshToken);
        localStorage.setItem("user_data", JSON.stringify(data.data.user));
      }

      return data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Login with Facebook
   */
  async loginWithFacebook(payload) {
    try {
      const response = await axiosInstance.post(
        API_ENDPOINTS.AUTH.FACEBOOK_LOGIN,
        payload
      );
      const data = response.data;

      // 🧩 Lưu token & user vào localStorage
      if (data?.data?.tokens?.accessToken) {
        localStorage.setItem("accessToken", data.data.tokens.accessToken);
        localStorage.setItem("refreshToken", data.data.tokens.refreshToken);
        localStorage.setItem("user_data", JSON.stringify(data.data.user));
      }

      return data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Register new user
   */
  async register(userData) {
    try {
      const response = await axiosInstance.post(
        API_ENDPOINTS.AUTH.REGISTER,
        userData
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(token) {
    try {
      const response = await axiosInstance.get(
        API_ENDPOINTS.AUTH.VERIFY_EMAIL(token)
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email) {
    try {
      const response = await axiosInstance.post(
        API_ENDPOINTS.AUTH.RESEND_VERIFICATION,
        { email }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Forgot password
   */
  async forgotPassword(email) {
    try {
      const response = await axiosInstance.post(
        API_ENDPOINTS.AUTH.FORGOT_PASSWORD,
        { email }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Reset password
   */
  async resetPassword(token, password) {
    try {
      const response = await axiosInstance.post(
        API_ENDPOINTS.AUTH.RESET_PASSWORD(token),
        { password }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Change password (authenticated user)
   */
  async changePassword(currentPassword, newPassword) {
    try {
      const response = await axiosInstance.post(
        API_ENDPOINTS.AUTH.CHANGE_PASSWORD,
        {
          currentPassword,
          newPassword,
        }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser() {
    try {
      const response = await axiosInstance.get(API_ENDPOINTS.AUTH.ME);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    try {
      const response = await axiosInstance.post(
        API_ENDPOINTS.AUTH.REFRESH_TOKEN,
        {
          refreshToken,
        }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Logout user (client-side cleanup)
   */
  logout() {
    // Clear tokens from localStorage
    localStorage.removeItem("auth_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_data");

    // Redirect to home page
    window.location.href = "/";
  }

  /**
   * Handle API errors
   */
  handleError(error) {
    // Giữ nguyên error response để AuthContext có thể xử lý error code và status
    // Đặc biệt cho trường hợp 403 với AUTH_010 (inactive) hoặc AUTH_011 (banned)
    if (error.response?.data) {
      // Với 401, giữ nguyên error để axios interceptor xử lý
      // Với 403 có error code, giữ nguyên error để AuthContext/LoginForm xử lý
      if (error.response.status === 401 || 
          error.response.status === 403 && error.response.data?.error?.code) {
        return error;
      }
      // Các lỗi khác, tạo Error mới với message
      const errorMessage = error.response.data.error?.message || 
                          error.response.data.message || 
                          "Đã có lỗi xảy ra";
      const newError = new Error(errorMessage);
      newError.response = error.response; // Giữ response để có thể truy cập error code
      return newError;
    }
    return error;
  }
}

export default new AuthService();
