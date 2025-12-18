import axiosInstance from "../../utils/api/axios";
import API_CONFIG from "../../config/api.config";

class ChatService {
  /**
   * Send message to AI chat analytics
   */
  async sendMessage({ message, account_id, conversation_id = null }) {
    try {
      const response = await axiosInstance.post(
        `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/ai/chat/analyze`,
        {
          message,
          account_id,
          conversation_id,
        }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Start new conversation session
   */
  async startConversation({ account_id }) {
    try {
      const response = await axiosInstance.post(
        `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/ai/chat/conversation/start`,
        {
          account_id,
        }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Handle API errors
   */
  handleError(error) {
    if (error.response) {
      const message =
        error.response.data?.message ||
        error.response.data?.error ||
        "Đã xảy ra lỗi";
      return {
        success: false,
        message,
        status: error.response.status,
      };
    } else if (error.request) {
      return {
        success: false,
        message: "Không thể kết nối đến server",
        status: 0,
      };
    } else {
      return {
        success: false,
        message: error.message || "Đã xảy ra lỗi không xác định",
        status: 0,
      };
    }
  }
}

export const chatService = new ChatService();
export default chatService;
