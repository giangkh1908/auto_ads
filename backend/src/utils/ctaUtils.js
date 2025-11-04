/**
 * Utility functions cho CTA conversion (Backend)
 */

// Mapping: CTA tiếng Việt → Facebook API CTA type
const CTA_VI_TO_FB_TYPE = {
  'Tìm hiểu thêm': 'LEARN_MORE',
  'Đăng ký ngay': 'SIGN_UP',
  'Liên hệ ngay': 'MESSAGE_PAGE',
  'Nhận ưu đãi': 'GET_OFFER',
  'Đặt ngay': 'BOOK_TRAVEL',
  'Mua ngay': 'SHOP_NOW',
  'Tải xuống': 'DOWNLOAD',
  'Xem khuyến mãi': 'GET_OFFER',
  'Xem suất chiếu': 'WATCH_VIDEO',
  'Nghe ngay': 'LISTEN_MUSIC',
  'Nhận quyền truy cập': 'USE_APP',
  'Xem menu': 'VIEW_SHOWTIMES',
};

// Reverse mapping: Facebook API CTA type → CTA tiếng Việt
const CTA_FB_TYPE_TO_VI = Object.entries(CTA_VI_TO_FB_TYPE).reduce((acc, [vi, fb]) => {
  acc[fb] = vi;
  return acc;
}, {});

const DEFAULT_CTA = 'Tìm hiểu thêm';
const DEFAULT_CTA_FB_TYPE = CTA_VI_TO_FB_TYPE[DEFAULT_CTA];

/**
 * Convert CTA tiếng Việt → Facebook API Type
 * @param {string} ctaVi - CTA text tiếng Việt
 * @returns {string} - Facebook API CTA type
 */
export function convertCTAToFacebookType(ctaVi) {
  if (!ctaVi) return DEFAULT_CTA_FB_TYPE;
  
  // Nếu đã là Facebook type rồi (từ DB hoặc API), trả về nguyên vẹn
  if (CTA_FB_TYPE_TO_VI[ctaVi]) {
    return ctaVi;
  }
  
  // Convert từ tiếng Việt sang Facebook type
  return CTA_VI_TO_FB_TYPE[ctaVi] || DEFAULT_CTA_FB_TYPE;
}

/**
 * Convert Facebook API Type → CTA tiếng Việt
 * @param {string} fbType - Facebook API CTA type
 * @returns {string} - CTA text tiếng Việt
 */
export function convertFacebookTypeToCTA(fbType) {
  if (!fbType) return DEFAULT_CTA;
  
  // Nếu đã là tiếng Việt rồi, trả về nguyên vẹn
  if (CTA_VI_TO_FB_TYPE[fbType]) {
    return fbType;
  }
  
  // Convert từ Facebook type sang tiếng Việt
  return CTA_FB_TYPE_TO_VI[fbType] || DEFAULT_CTA;
}

export { DEFAULT_CTA, DEFAULT_CTA_FB_TYPE };

