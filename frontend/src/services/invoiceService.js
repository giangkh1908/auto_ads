import axiosInstance from "../utils/axios";
import { API_ENDPOINTS } from "../config/api.config";

const invoiceService = {
  /**
   * Lấy invoice theo transaction ID
   */
  getInvoiceByTransactionId: async (transactionId) => {
    try {
      const response = await axiosInstance.get(
        API_ENDPOINTS.INVOICES.BY_TRANSACTION(transactionId)
      );
      return response.data;
    } catch (error) {
      console.error("Error getting invoice by transaction ID:", error);
      throw error;
    }
  },

  /**
   * Lấy invoice theo ID
   */
  getInvoiceById: async (invoiceId) => {
    try {
      const response = await axiosInstance.get(
        API_ENDPOINTS.INVOICES.DETAIL(invoiceId)
      );
      return response.data;
    } catch (error) {
      console.error("Error getting invoice by ID:", error);
      throw error;
    }
  },
};

export default invoiceService;

