import axiosInstance from '../utils/axios';

export const publishAdsWizard = async (wizardData) => {
  try {
    const response = await axiosInstance.post('/api/ads-wizard/publish', wizardData);
    return response.data;
  } catch (error) {
    // Rethrow original axios error to preserve error.response (including error_user_msg)
    throw handleError(error);
  }
};

export const updateAdsWizard = async (wizardData) => {
  try {
    const response = await axiosInstance.put(
      "/api/ads-wizard/update",
      wizardData
    );
    return response.data;
  } catch (error) {
    // Rethrow original axios error to preserve error.response (including error_user_msg)
    throw handleError(error);
  }
};

/**
 * 🔄 Update nhiều campaigns với cấu trúc linh hoạt (cascade update)
 * Hỗ trợ update matching entities, tạo mới nếu chưa có
 */
export const updateFlexibleAdsWizard = async (wizardData) => {
  try {
    const response = await axiosInstance.put(
      '/api/ads-wizard/update-flexible',
      wizardData,
      { timeout: 120000 } // 120 seconds = 2 minutes (đủ cho update nhiều ads)
    );
    return response.data;
  } catch (error) {
    // Rethrow original axios error to preserve error.response (including error_user_msg)
    throw handleError(error);
  }
};

/**
 * 💾 Lưu nháp campaign/adset/ad
 */
export const saveDraft = async (data) => {
  try {
    const response = await axiosInstance.post('/api/ads-wizard/save-draft', data);
    return response.data;
  } catch (error) {
    console.error('Error saving draft:', error);
    throw handleError(error);
  }
};

// Xử lý lỗi chuẩn cho service
function handleError(error) {
  return error;
}