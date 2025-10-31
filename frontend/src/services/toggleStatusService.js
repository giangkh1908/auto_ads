import axiosInstance from '../utils/axios';

/**
 * Toggle campaign status on Facebook
 * @param {string} campaignId - Facebook campaign ID (external_id)
 * @param {string} status - "ACTIVE" | "PAUSED"
 * @returns {Promise<Object>} API response
 */
export const toggleCampaignStatus = async (campaignId, status) => {
  try {
    const response = await axiosInstance.patch(`/api/campaigns/${campaignId}/status`, {
      status: status
    });
    return response.data;
  } catch (error) {
    const detail = error.response?.data?.detail;
    const message = error.response?.data?.message || 'Lỗi cập nhật trạng thái campaign';
    throw new Error(detail ? `${message}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : message);
  }
};

/**
 * Toggle adset status on Facebook
 * @param {string} adsetId - Facebook adset ID (external_id)
 * @param {string} status - "ACTIVE" | "PAUSED"
 * @returns {Promise<Object>} API response
 */
export const toggleAdsetStatus = async (adsetId, status) => {
  try {
    const response = await axiosInstance.patch(`/api/adsets/${adsetId}/status`, {
      status: status
    });
    return response.data;
  } catch (error) {
    const detail = error.response?.data?.detail;
    const message = error.response?.data?.message || 'Lỗi cập nhật trạng thái adset';
    throw new Error(detail ? `${message}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : message);
  }
};

/**
 * Toggle ad status on Facebook
 * @param {string} adId - Facebook ad ID (external_id)
 * @param {string} status - "ACTIVE" | "PAUSED"
 * @returns {Promise<Object>} API response
 */
export const toggleAdStatus = async (adId, status) => {
  try {
    const response = await axiosInstance.patch(`/api/ads/${adId}/status`, {
      status: status
    });
    return response.data;
  } catch (error) {
    const detail = error.response?.data?.detail;
    const message = error.response?.data?.message || 'Lỗi cập nhật trạng thái ad';
    throw new Error(detail ? `${message}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : message);
  }
};

/**
 * Toggle status for any entity type
 * @param {string} entityType - "campaign" | "adset" | "ad"
 * @param {string} entityId - Facebook entity ID (external_id)
 * @param {string} status - "ACTIVE" | "PAUSED"
 * @returns {Promise<Object>} API response
 */
export const toggleEntityStatus = async (entityType, entityId, status) => {
  switch (entityType) {
    case 'campaign':
      return await toggleCampaignStatus(entityId, status);
    case 'adset':
      return await toggleAdsetStatus(entityId, status);
    case 'ad':
      return await toggleAdStatus(entityId, status);
    default:
      throw new Error(`Không hỗ trợ entity type: ${entityType}`);
  }
};
