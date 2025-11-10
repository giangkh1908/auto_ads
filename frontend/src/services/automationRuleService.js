import axiosInstance from "../utils/axios";
import { API_ENDPOINTS } from "../config/api.config";

class AutomationRuleService {
  /**
   * Lấy danh sách automation rules
   * @param {Object} params - Query parameters (account_id, page, limit, fetch_all)
   * @returns {Promise} Response từ API
   */
  async getRules(params = {}) {
    try {
      const response = await axiosInstance.get(
        API_ENDPOINTS.AUTOMATION_RULES.LIST,
        { params }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Lấy chi tiết automation rule theo ID
   * @param {String} id - Rule ID
   * @returns {Promise} Response từ API
   */
  async getRuleById(id) {
    try {
      const response = await axiosInstance.get(
        API_ENDPOINTS.AUTOMATION_RULES.DETAIL(id)
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Tạo automation rule mới
   * @param {Object} ruleData - Rule data
   * @returns {Promise} Response từ API
   */
  async createRule(ruleData) {
    try {
      const response = await axiosInstance.post(
        API_ENDPOINTS.AUTOMATION_RULES.CREATE,
        ruleData
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Cập nhật automation rule
   * @param {String} id - Rule ID
   * @param {Object} ruleData - Updated rule data
   * @returns {Promise} Response từ API
   */
  async updateRule(id, ruleData) {
    try {
      const response = await axiosInstance.put(
        API_ENDPOINTS.AUTOMATION_RULES.UPDATE(id),
        ruleData
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Xóa automation rule
   * @param {String} id - Rule ID
   * @returns {Promise} Response từ API
   */
  async deleteRule(id) {
    try {
      const response = await axiosInstance.delete(
        API_ENDPOINTS.AUTOMATION_RULES.DELETE(id)
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Bật/tắt automation rule
   * @param {String} id - Rule ID
   * @returns {Promise} Response từ API
   */
  async toggleRule(id) {
    try {
      const response = await axiosInstance.patch(
        API_ENDPOINTS.AUTOMATION_RULES.TOGGLE(id)
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }
}

export default new AutomationRuleService();

