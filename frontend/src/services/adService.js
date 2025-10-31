import axiosInstance from '../utils/axios'
import { API_ENDPOINTS } from '../config/api.config'

/**
 * Ad Service
 * Handles ad-related API calls
 */

// Publish Ads Wizard - tạo cùng lúc campaign, adset, creative và ad
export const publishAdsWizard = async (wizardData) => {
  try {
    const response = await axiosInstance.post('/api/ads/wizard/publish', wizardData)
    return response.data
  } catch (error) {
    console.error('Error publishing ads wizard:', error)
    throw error.response?.data || { 
      success: false, 
      message: "Có lỗi xảy ra khi tạo quảng cáo", 
      detail: error.message 
    }
  }
}

// Create Campaign
export const createAd = async (formData) => {
  try {
    const response = await axiosInstance.post(API_ENDPOINTS.CAMPAIGNS.CREATE, formData)
    return response.data
  } catch (error) {
    console.error('Error creating ad:', error)
    throw error
  }
}

// Get Ads Status
export const getAdsStatus = async () => {
  try {
    const response = await axiosInstance.get(API_ENDPOINTS.ADS.STATUS)
    return response.data
  } catch (error) {
    console.error('Error fetching ads status:', error)
    throw error
  }
}

// Update Campaign
export const updateCampaign = async (id, data) => {
  try {
    const response = await axiosInstance.put(API_ENDPOINTS.CAMPAIGNS.UPDATE(id), data)
    return response.data
  } catch (error) {
    console.error('Error updating campaign:', error)
    throw error
  }
}

// Update AdSet
export const updateAdSet = async (id, data) => {
  try {
    const response = await axiosInstance.put(API_ENDPOINTS.ADSETS.UPDATE(id), data)
    return response.data
  } catch (error) {
    console.error('Error updating ad set:', error)
    throw error
  }
}

// Update Ad
export const updateAd = async (id, data) => {
  try {
    const response = await axiosInstance.put(API_ENDPOINTS.ADS.UPDATE(id), data)
    return response.data
  } catch (error) {
    console.error('Error updating ad:', error)
    throw error
  }
}

// Delete Campaign
export const deleteCampaign = async (id, accessToken = null) => {
  try {
    const url = API_ENDPOINTS.CAMPAIGNS.DELETE(id, accessToken);
    const response = await axiosInstance.delete(url, { timeout: 120000 });
    return response.data;
  } catch (error) {
    console.error('Error deleting campaign:', error);
    throw error;
  }
};

// Delete AdSet
export const deleteAdSet = async (id, accessToken = null) => {
  try {
    const url = API_ENDPOINTS.ADSETS.DELETE(id, accessToken);
    const response = await axiosInstance.delete(url, { timeout: 60000 });
    return response.data;
  } catch (error) {
    console.error('Error deleting ad set:', error);
    throw error;
  }
};

// Delete Ad
export const deleteAd = async (id, accessToken = null) => {
  try {
    const url = API_ENDPOINTS.ADS.DELETE(id, accessToken);
    const response = await axiosInstance.delete(url, { timeout: 30000 });
    return response.data;
  } catch (error) {
    console.error('Error deleting ad:', error);
    throw error;
  }
};

// Copy Campaign (DB only)
export const copyCampaign = async (id) => {
  try {
    const response = await axiosInstance.post(`/api/campaigns/${id}/copy`);
    return response.data;
  } catch (error) {
    console.error('Error copying campaign:', error);
    throw error;
  }
};

// Copy AdSet (DB only)
export const copyAdSet = async (id) => {
  try {
    const response = await axiosInstance.post(`/api/adsets/${id}/copy`);
    return response.data;
  } catch (error) {
    console.error('Error copying ad set:', error);
    throw error;
  }
};

// Copy Ad (DB only)
export const copyAd = async (id) => {
  try {
    const response = await axiosInstance.post(`/api/ads/${id}/copy`);
    return response.data;
  } catch (error) {
    console.error('Error copying ad:', error);
    throw error;
  }
};