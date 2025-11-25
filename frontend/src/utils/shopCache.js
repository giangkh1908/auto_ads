/**
 * Utility để quản lý cache shop trong localStorage
 * Giúp tránh load lại shop nhiều lần và đồng bộ giữa các components
 */

import { STORAGE_KEYS } from "../constants/app.constants";

const CACHE_KEY = "currentShopCache";
const SHOP_ID_KEY = "selectedShopId";
const SHOP_CHANGE_EVENT = "shopChanged";

/**
 * Xóa tất cả cache liên quan đến ads accounts và ads
 */
export const clearAdsCache = () => {
  try {
    // 1. Xóa selected ad account
    localStorage.removeItem('selectedAdAccount');
    
    // 2. Xóa selected account (dùng trong Analytics)
    localStorage.removeItem('selected_account_id');
    localStorage.removeItem('selected_account_name');
    
    // 3. Xóa tất cả cache keys liên quan đến campaigns, adsets, ads
    const entityTypes = ['campaigns', 'adsets', 'ads'];
    const cacheKeysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      // Kiểm tra các pattern cache keys của campaigns, adsets, ads
      const matchesPattern = entityTypes.some(type => {
        // Pattern: `${type}_all_${accountId}` hoặc `${type}_${contextId}_${accountId}`
        const pattern1 = new RegExp(`^${type}_(all|\\w+)_\\w+$`);
        // Pattern: `${accountId}_${type}`
        const pattern2 = new RegExp(`^\\w+_${type}$`);
        return pattern1.test(key) || pattern2.test(key);
      });
      
      if (matchesPattern) {
        cacheKeysToRemove.push(key);
      }
    }
    
    cacheKeysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log('✅ Đã xóa cache key:', key);
    });
    
    console.log('✅ Đã xóa tất cả cache của ads accounts và ads khi chuyển shop');
  } catch (error) {
    console.error('❌ Lỗi khi xóa cache ads:', error);
  }
};

/**
 * Lưu shop vào cache và thông báo thay đổi
 * @param {Object} shop - Thông tin shop
 * @param {Object} previousShop - Shop trước đó (để kiểm tra có thay đổi không)
 */
export const saveShopCache = (shop, previousShop = null) => {
  try {
    if (!shop) {
      clearShopCache();
      return;
    }
    
    // Kiểm tra xem shop có thay đổi không
    const shopChanged = !previousShop || previousShop.id !== shop.id;
    
    // Nếu shop thay đổi, xóa cache ads
    if (shopChanged) {
      clearAdsCache();
    }
    
    // Lưu cache trước khi dispatch event để đảm bảo data có sẵn
    localStorage.setItem(CACHE_KEY, JSON.stringify(shop));
    localStorage.setItem(SHOP_ID_KEY, shop.id);
    
    // Dispatch event ngay sau khi lưu cache
    // Sử dụng setTimeout với delay 0 để đảm bảo localStorage đã được ghi
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent(SHOP_CHANGE_EVENT, { detail: shop }));
    }, 0);
  } catch (error) {
    console.error("Error saving shop cache:", error);
  }
};

/**
 * Lấy shop từ cache
 * @returns {Object|null} - Thông tin shop hoặc null nếu không có cache
 */
export const getShopCache = () => {
  try {
    const data = localStorage.getItem(CACHE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Error getting shop cache:", error);
    return null;
  }
};

/**
 * Xóa cache shop
 */
export const clearShopCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(SHOP_ID_KEY);
    window.dispatchEvent(new CustomEvent(SHOP_CHANGE_EVENT, { detail: null }));
  } catch (error) {
    console.error("Error clearing shop cache:", error);
  }
};

/**
 * Lắng nghe sự kiện thay đổi shop
 * @param {Function} callback - Callback function nhận shop mới
 * @returns {Function} - Hàm để remove listener
 */
export const onShopChange = (callback) => {
  const handler = (event) => callback(event.detail);
  window.addEventListener(SHOP_CHANGE_EVENT, handler);
  return () => window.removeEventListener(SHOP_CHANGE_EVENT, handler);
};

