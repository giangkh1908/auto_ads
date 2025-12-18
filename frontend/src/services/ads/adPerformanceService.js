import axiosInstance from "../../utils/api/axios";

export const getAdPerformance = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.account_id) params.append("account_id", filters.account_id);
    if (filters.campaign_id) params.append("campaign_id", filters.campaign_id);
    if (filters.set_id) params.append("set_id", filters.set_id);
    if (filters.ads_id) params.append("ads_id", filters.ads_id);
    if (filters.dateFrom) params.append("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.append("dateTo", filters.dateTo);

    const response = await axiosInstance.get(`/api/ads/performance?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching ad performance:", error);
    throw error;
  }
};

export const refreshAdPerformance = async (accountId = null) => {
  try {
    const response = await axiosInstance.post("/api/ads/performance/refresh", {
      account_id: accountId
    });
    return response.data;
  } catch (error) {
    console.error("Error refreshing ad performance:", error);
    throw error;
  }
};

export const getAdPerformanceStats = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.account_id) params.append("account_id", filters.account_id);
    if (filters.dateFrom) params.append("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.append("dateTo", filters.dateTo);

    const response = await axiosInstance.get(`/api/ads/performance/stats?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching ad performance stats:", error);
    throw error;
  }
};