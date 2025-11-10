/**
 * Utility để quản lý cache shop trong localStorage
 * Giúp tránh load lại shop nhiều lần và đồng bộ giữa các components
 */

const CACHE_KEY = "currentShopCache";
const SHOP_ID_KEY = "selectedShopId";
const SHOP_CHANGE_EVENT = "shopChanged";

/**
 * Lưu shop vào cache và thông báo thay đổi
 * @param {Object} shop - Thông tin shop
 */
export const saveShopCache = (shop) => {
  try {
    if (!shop) {
      clearShopCache();
      return;
    }
    
    // Lưu đơn giản, không cần timestamp phức tạp
    localStorage.setItem(CACHE_KEY, JSON.stringify(shop));
    localStorage.setItem(SHOP_ID_KEY, shop.id);
    
    // Dispatch event để Header cập nhật ngay
    window.dispatchEvent(new CustomEvent(SHOP_CHANGE_EVENT, { detail: shop }));
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

