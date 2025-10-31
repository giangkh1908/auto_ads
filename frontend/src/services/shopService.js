import axiosInstance from '../utils/axios'
import { API_ENDPOINTS } from '../config/api.config'

class ShopService {
  async getMyShops() {
    try {
      const res = await axiosInstance.get(API_ENDPOINTS.SHOPS.MY_SHOPS)
      return res.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async updateShop(id, payload) {
    try {
      const res = await axiosInstance.put(API_ENDPOINTS.SHOPS.UPDATE(id), payload)
      return res.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async fetchFacebookPages() {
    try {
      const res = await axiosInstance.get(API_ENDPOINTS.SHOP_FACEBOOK.PAGES)
      return res.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async connectFacebookPage({ shopId, pageId, pageAccessToken }) {
    try {
      const res = await axiosInstance.post(API_ENDPOINTS.SHOP_FACEBOOK.CONNECT, { shopId, pageId, pageAccessToken })
      return res.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async disconnectFacebookPage({ shopId, pageId }) {
    try {
      const res = await axiosInstance.post(API_ENDPOINTS.SHOP_FACEBOOK.DISCONNECT, { shopId, pageId })
      return res.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async refreshFacebookToken() {
    try {
      const res = await axiosInstance.post(API_ENDPOINTS.SHOP_FACEBOOK.REFRESH_TOKEN)
      return res.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  handleError(error) {
    if (error?.response?.data) return error.response.data
    if (error?.message) return new Error(error.message)
    return error
  }
}

export default new ShopService()


