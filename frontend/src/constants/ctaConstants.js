/**
 * CTA Constants - Mapping giữa CTA tiếng Việt và Facebook API CTA types
 */

// Mapping: CTA tiếng Việt → Facebook API CTA type
export const CTA_VI_TO_FB_TYPE = {
  'Tìm hiểu thêm': 'LEARN_MORE',
  'Đăng ký ngay': 'SIGN_UP',
  'Liên hệ ngay': 'MESSAGE_PAGE', // Messenger message
  'Nhận ưu đãi': 'GET_OFFER',
  'Đặt ngay': 'BOOK_TRAVEL',
  'Mua ngay': 'SHOP_NOW',
  'Tải xuống': 'DOWNLOAD',
  'Xem khuyến mãi': 'GET_OFFER',
  'Xem suất chiếu': 'WATCH_VIDEO', // Hoặc có thể dùng cho event/showtimes
  'Nghe ngay': 'LISTEN_MUSIC',
  'Nhận quyền truy cập': 'USE_APP',
  'Xem menu': 'VIEW_SHOWTIMES', // Hoặc có thể customize
};

// Reverse mapping: Facebook API CTA type → CTA tiếng Việt
export const CTA_FB_TYPE_TO_VI = Object.entries(CTA_VI_TO_FB_TYPE).reduce((acc, [vi, fb]) => {
  acc[fb] = vi;
  return acc;
}, {});

// Danh sách CTA options theo thứ tự hiển thị
export const CTA_OPTIONS = [
  'Tìm hiểu thêm',
  'Đăng ký ngay',
  'Liên hệ ngay',
  'Nhận ưu đãi',
  'Đặt ngay',
  'Mua ngay',
  'Tải xuống',
  'Xem khuyến mãi',
  'Xem suất chiếu',
  'Nghe ngay',
  'Nhận quyền truy cập',
  'Xem menu',
];

// CTA mặc định
export const DEFAULT_CTA = 'Tìm hiểu thêm';
export const DEFAULT_CTA_FB_TYPE = CTA_VI_TO_FB_TYPE[DEFAULT_CTA];

