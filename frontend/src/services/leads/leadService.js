import axiosInstance from "../../utils/api/axios";
import { API_ENDPOINTS } from "../../config/api.config";

/**
 * Lead Service
 * Handles lead-related API calls
 */
class LeadService {
  /**
   * Create a new lead (public form - no authentication required)
   */
  async createLead(leadData) {
    try {
      const response = await axiosInstance.post(
        API_ENDPOINTS.LEADS.CREATE,
        leadData
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get list of leads (requires authentication)
   */
  async getLeads(params = {}) {
    try {
      const response = await axiosInstance.get(API_ENDPOINTS.LEADS.LIST, {
        params,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update lead status
   */
  async updateLeadStatus(leadId, status) {
    try {
      const response = await axiosInstance.put(
        API_ENDPOINTS.LEADS.UPDATE_STATUS(leadId),
        { status }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Assign lead to user
   */
  async assignLead(leadId, assignedTo) {
    try {
      const response = await axiosInstance.put(
        API_ENDPOINTS.LEADS.ASSIGN(leadId),
        { assigned_to: assignedTo }
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
      // Server responded with error
      const { data, status } = error.response;
      const errorObj = {
        message: data?.message || "Có lỗi xảy ra",
        status,
        data: data,
      };
      // Throw error with message property for easy access
      const apiError = new Error(errorObj.message);
      apiError.status = errorObj.status;
      apiError.data = errorObj.data;
      throw apiError;
    } else if (error.request) {
      // Request was made but no response received
      const apiError = new Error("Không thể kết nối đến server. Vui lòng thử lại sau.");
      apiError.status = 0;
      throw apiError;
    } else {
      // Something else happened
      const apiError = new Error(error.message || "Có lỗi xảy ra");
      apiError.status = 0;
      throw apiError;
    }
  }
}

export default new LeadService();

