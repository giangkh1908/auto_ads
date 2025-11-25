import axiosInstance from "../utils/axios";

/**
 * Payment Transaction Service
 * Handles payment transaction-related API calls
 */
class PaymentTransactionService {
  /**
   * Get list of payment transactions
   * @param {Object} params - Query parameters (page, limit, status, user_id, package_id)
   * @returns {Promise} Response từ API
   */
  async getPaymentTransactions(params = {}) {
    try {
      const response = await axiosInstance.get("/api/payment-transactions", {
        params,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get payment transaction by ID
   * @param {String} id - Transaction ID
   * @returns {Promise} Response từ API
   */
  async getPaymentTransactionById(id) {
    try {
      const response = await axiosInstance.get(
        `/api/payment-transactions/${id}`
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update payment transaction
   * @param {String} id - Transaction ID
   * @param {Object} data - Update data
   * @returns {Promise} Response từ API
   */
  async updatePaymentTransaction(id, data) {
    try {
      const response = await axiosInstance.put(
        `/api/payment-transactions/${id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Approve payment transaction
   * @param {String} id - Transaction ID
   * @returns {Promise} Response từ API
   */
  async approveTransaction(id) {
    try {
      const response = await axiosInstance.put(
        `/api/payment-transactions/${id}`,
        { status: "success", accept_at: new Date() }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Reject payment transaction
   * @param {String} id - Transaction ID
   * @param {String} note - Rejection note
   * @returns {Promise} Response từ API
   */
  async rejectTransaction(id, note = "") {
    try {
      const response = await axiosInstance.put(
        `/api/payment-transactions/${id}`,
        {
          status: "rejected",
          metadata: { rejectReason: note },
        }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  handleError(error) {
    if (error?.response?.data) return error.response.data;
    if (error?.message) return new Error(error.message);
    return error;
  }
}

export default new PaymentTransactionService();

