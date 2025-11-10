// src/constants/successCode.ts
// SUCCESS CODE + MESSAGE ĐẦY ĐỦ CHO ADS PLATFORM (Facebook/TikTok/Google Ads Style)

export const SuccessCode = Object.freeze ({
    // ==================== COMMON ====================
    SUCCESS_000: 'SUCCESS_000', // General success
    SUCCESS_001: 'SUCCESS_001', // Action completed successfully
    SUCCESS_002: 'SUCCESS_002', // Data retrieved successfully
    SUCCESS_003: 'SUCCESS_003', // Resource created successfully
    SUCCESS_004: 'SUCCESS_004', // Resource updated successfully
    SUCCESS_005: 'SUCCESS_005', // Resource deleted successfully
  
    // ==================== AUTH ====================
    AUTH_SUCCESS_001: 'AUTH_SUCCESS_001', // Login successful
    AUTH_SUCCESS_002: 'AUTH_SUCCESS_002', // Logout successful
    AUTH_SUCCESS_003: 'AUTH_SUCCESS_003', // Register successful
    AUTH_SUCCESS_004: 'AUTH_SUCCESS_004', // Password changed
    AUTH_SUCCESS_005: 'AUTH_SUCCESS_005', // Email verified
    AUTH_SUCCESS_006: 'AUTH_SUCCESS_006', // Token refreshed
  
    // ==================== SHOP ====================
    SHOP_SUCCESS_001: 'SHOP_SUCCESS_001', // Shop created
    SHOP_SUCCESS_002: 'SHOP_SUCCESS_002', // Shop updated
    SHOP_SUCCESS_003: 'SHOP_SUCCESS_003', // Shop verified
    SHOP_SUCCESS_004: 'SHOP_SUCCESS_004', // Shop switched
  
    // ==================== AD ACCOUNT ====================
    ADACC_SUCCESS_001: 'ADACC_SUCCESS_001', // Ad account created
    ADACC_SUCCESS_002: 'ADACC_SUCCESS_002', // Ad account linked
    ADACC_SUCCESS_003: 'ADACC_SUCCESS_003', // Ad account approved
    ADACC_SUCCESS_004: 'ADACC_SUCCESS_004', // Billing info updated
    ADACC_SUCCESS_005: 'ADACC_SUCCESS_005', // Balance topped up
  
    // ==================== CAMPAIGN ====================
    CAMP_SUCCESS_001: 'CAMP_SUCCESS_001', // Campaign created
    CAMP_SUCCESS_002: 'CAMP_SUCCESS_002', // Campaign updated
    CAMP_SUCCESS_003: 'CAMP_SUCCESS_003', // Campaign duplicated
    CAMP_SUCCESS_004: 'CAMP_SUCCESS_004', // Campaign started
    CAMP_SUCCESS_005: 'CAMP_SUCCESS_005', // Campaign paused
    CAMP_SUCCESS_006: 'CAMP_SUCCESS_006', // Campaign resumed
    CAMP_SUCCESS_007: 'CAMP_SUCCESS_007', // Campaign archived
    CAMP_SUCCESS_008: 'CAMP_SUCCESS_008', // Campaign deleted (draft)
  
    // ==================== AD SET ====================
    ADSET_SUCCESS_001: 'ADSET_SUCCESS_001', // Ad set created
    ADSET_SUCCESS_002: 'ADSET_SUCCESS_002', // Ad set updated
    ADSET_SUCCESS_003: 'ADSET_SUCCESS_003', // Ad set duplicated
    ADSET_SUCCESS_004: 'ADSET_SUCCESS_004', // Ad set started
    ADSET_SUCCESS_005: 'ADSET_SUCCESS_005', // Ad set paused
  
    // ==================== AD ====================
    AD_SUCCESS_001: 'AD_SUCCESS_001', // Ad created
    AD_SUCCESS_002: 'AD_SUCCESS_002', // Ad updated
    AD_SUCCESS_003: 'AD_SUCCESS_003', // Ad duplicated
    AD_SUCCESS_004: 'AD_SUCCESS_004', // Ad submitted for review
    AD_SUCCESS_005: 'AD_SUCCESS_005', // Ad approved
    AD_SUCCESS_006: 'AD_SUCCESS_006', // Ad rejected (with reason) → vẫn là success vì có phản hồi
    AD_SUCCESS_007: 'AD_SUCCESS_007', // Ad published
    AD_SUCCESS_008: 'AD_SUCCESS_008', // Ad paused
    AD_SUCCESS_009: 'AD_SUCCESS_009', // Ad resumed
  
    // ==================== EMPLOYEE & ROLE ====================
    EMP_SUCCESS_001: 'EMP_SUCCESS_001', // Employee invited
    EMP_SUCCESS_002: 'EMP_SUCCESS_002', // Employee added
    EMP_SUCCESS_003: 'EMP_SUCCESS_003', // Employee role updated
    EMP_SUCCESS_004: 'EMP_SUCCESS_004', // Employee removed
    ROLE_SUCCESS_001: 'ROLE_SUCCESS_001', // Role created
    ROLE_SUCCESS_002: 'ROLE_SUCCESS_002', // Role updated
  
    // ==================== BUDGET & PAYMENT ====================
    PAY_SUCCESS_001: 'PAY_SUCCESS_001', // Payment successful
    PAY_SUCCESS_002: 'PAY_SUCCESS_002', // Top-up successful
    PAY_SUCCESS_003: 'PAY_SUCCESS_003', // Refund processed
    PAY_SUCCESS_004: 'PAY_SUCCESS_004', // Invoice generated
  
    // ==================== REPORT & INSIGHT ====================
    REPORT_SUCCESS_001: 'REPORT_SUCCESS_001', // Report generated
    REPORT_SUCCESS_002: 'REPORT_SUCCESS_002', // Report exported
    REPORT_SUCCESS_003: 'REPORT_SUCCESS_003', // Schedule report created
  
    // ==================== NOTIFICATION ====================
    NOTI_SUCCESS_001: 'NOTI_SUCCESS_001', // Notification sent
    NOTI_SUCCESS_002: 'NOTI_SUCCESS_002', // Notifications marked as read
  });
  
  // export type SuccessCode = typeof SuccessCode[keyof typeof SuccessCode];
  
  /**
   * SuccessMessage - ĐẦY ĐỦ 100% CHO TẤT CẢ MÃ
   * Tiếng Việt + Tiếng Anh
   */
   export const SuccessMessage = Object.freeze ({
    // COMMON
    [SuccessCode.SUCCESS_000]: { vi: 'Thành công', en: 'Success' },
    [SuccessCode.SUCCESS_001]: { vi: 'Thao tác thực hiện thành công', en: 'Action completed successfully' },
    [SuccessCode.SUCCESS_002]: { vi: 'Lấy dữ liệu thành công', en: 'Data retrieved successfully' },
    [SuccessCode.SUCCESS_003]: { vi: 'Tạo mới thành công', en: 'Created successfully' },
    [SuccessCode.SUCCESS_004]: { vi: 'Cập nhật thành công', en: 'Updated successfully' },
    [SuccessCode.SUCCESS_005]: { vi: 'Xóa thành công', en: 'Deleted successfully' },
  
    // AUTH
    [SuccessCode.AUTH_SUCCESS_001]: { vi: 'Đăng nhập thành công', en: 'Login successful' },
    [SuccessCode.AUTH_SUCCESS_002]: { vi: 'Đăng xuất thành công', en: 'Logout successful' },
    [SuccessCode.AUTH_SUCCESS_003]: { vi: 'Đăng ký thành công. Vui lòng kiểm tra email để xác minh', en: 'Registration successful. Please check your email to verify' },
    [SuccessCode.AUTH_SUCCESS_004]: { vi: 'Đổi mật khẩu thành công', en: 'Password changed successfully' },
    [SuccessCode.AUTH_SUCCESS_005]: { vi: 'Xác minh email thành công', en: 'Email verified successfully' },
    [SuccessCode.AUTH_SUCCESS_006]: { vi: 'Làm mới token thành công', en: 'Token refreshed successfully' },
  
    // SHOP
    [SuccessCode.SHOP_SUCCESS_001]: { vi: 'Tạo cửa hàng thành công', en: 'Shop created successfully' },
    [SuccessCode.SHOP_SUCCESS_002]: { vi: 'Cập nhật cửa hàng thành công', en: 'Shop updated successfully' },
    [SuccessCode.SHOP_SUCCESS_003]: { vi: 'Cửa hàng đã được xác minh thành công', en: 'Shop verified successfully' },
    [SuccessCode.SHOP_SUCCESS_004]: { vi: 'Chuyển đổi cửa hàng thành công', en: 'Shop switched successfully' },
  
    // AD ACCOUNT
    [SuccessCode.ADACC_SUCCESS_001]: { vi: 'Tạo tài khoản quảng cáo thành công', en: 'Ad account created successfully' },
    [SuccessCode.ADACC_SUCCESS_002]: { vi: 'Liên kết tài khoản quảng cáo thành công', en: 'Ad account linked successfully' },
    [SuccessCode.ADACC_SUCCESS_003]: { vi: 'Tài khoản quảng cáo đã được duyệt', en: 'Ad account approved' },
    [SuccessCode.ADACC_SUCCESS_004]: { vi: 'Cập nhật thông tin thanh toán thành công', en: 'Billing info updated successfully' },
    [SuccessCode.ADACC_SUCCESS_005]: { vi: 'Nạp tiền thành công. Số dư đã được cập nhật', en: 'Balance topped up successfully' },
  
    // CAMPAIGN
    [SuccessCode.CAMP_SUCCESS_001]: { vi: 'Tạo chiến dịch thành công', en: 'Campaign created successfully' },
    [SuccessCode.CAMP_SUCCESS_002]: { vi: 'Cập nhật chiến dịch thành công', en: 'Campaign updated successfully' },
    [SuccessCode.CAMP_SUCCESS_003]: { vi: 'Nhân bản chiến dịch thành công', en: 'Campaign duplicated successfully' },
    [SuccessCode.CAMP_SUCCESS_004]: { vi: 'Khởi động chiến dịch thành công', en: 'Campaign started successfully' },
    [SuccessCode.CAMP_SUCCESS_005]: { vi: 'Tạm dừng chiến dịch thành công', en: 'Campaign paused successfully' },
    [SuccessCode.CAMP_SUCCESS_006]: { vi: 'Tiếp tục chạy chiến dịch thành công', en: 'Campaign resumed successfully' },
    [SuccessCode.CAMP_SUCCESS_007]: { vi: 'Lưu trữ chiến dịch thành công', en: 'Campaign archived successfully' },
    [SuccessCode.CAMP_SUCCESS_008]: { vi: 'Xóa bản nháp chiến dịch thành công', en: 'Draft campaign deleted successfully' },
  
    // AD SET
    [SuccessCode.ADSET_SUCCESS_001]: { vi: 'Tạo nhóm quảng cáo thành công', en: 'Ad set created successfully' },
    [SuccessCode.ADSET_SUCCESS_002]: { vi: 'Cập nhật nhóm quảng cáo thành công', en: 'Ad set updated successfully' },
    [SuccessCode.ADSET_SUCCESS_003]: { vi: 'Nhân bản nhóm quảng cáo thành công', en: 'Ad set duplicated successfully' },
    [SuccessCode.ADSET_SUCCESS_004]: { vi: 'Khởi động nhóm quảng cáo thành công', en: 'Ad set started successfully' },
    [SuccessCode.ADSET_SUCCESS_005]: { vi: 'Tạm dừng nhóm quảng cáo thành công', en: 'Ad set paused successfully' },
  
    // AD
    [SuccessCode.AD_SUCCESS_001]: { vi: 'Tạo quảng cáo thành công', en: 'Ad created successfully' },
    [SuccessCode.AD_SUCCESS_002]: { vi: 'Cập nhật quảng cáo thành công', en: 'Ad updated successfully' },
    [SuccessCode.AD_SUCCESS_003]: { vi: 'Nhân bản quảng cáo thành công', en: 'Ad duplicated successfully' },
    [SuccessCode.AD_SUCCESS_004]: { vi: 'Gửi quảng cáo đi duyệt thành công', en: 'Ad submitted for review successfully' },
    [SuccessCode.AD_SUCCESS_005]: { vi: 'Quảng cáo đã được duyệt', en: 'Ad approved' },
    [SuccessCode.AD_SUCCESS_006]: { vi: 'Quảng cáo bị từ chối (xem lý do để chỉnh sửa)', en: 'Ad rejected (check reason to edit)' },
    [SuccessCode.AD_SUCCESS_007]: { vi: 'Xuất bản quảng cáo thành công', en: 'Ad published successfully' },
    [SuccessCode.AD_SUCCESS_008]: { vi: 'Tạm dừng quảng cáo thành công', en: 'Ad paused successfully' },
    [SuccessCode.AD_SUCCESS_009]: { vi: 'Tiếp tục chạy quảng cáo thành công', en: 'Ad resumed successfully' },
  
    // EMPLOYEE & ROLE
    [SuccessCode.EMP_SUCCESS_001]: { vi: 'Gửi lời mời nhân viên thành công', en: 'Employee invitation sent successfully' },
    [SuccessCode.EMP_SUCCESS_002]: { vi: 'Thêm nhân viên thành công', en: 'Employee added successfully' },
    [SuccessCode.EMP_SUCCESS_003]: { vi: 'Cập nhật quyền nhân viên thành công', en: 'Employee role updated successfully' },
    [SuccessCode.EMP_SUCCESS_004]: { vi: 'Xóa nhân viên thành công', en: 'Employee removed successfully' },
    [SuccessCode.ROLE_SUCCESS_001]: { vi: 'Tạo vai trò mới thành công', en: 'Role created successfully' },
    [SuccessCode.ROLE_SUCCESS_002]: { vi: 'Cập nhật vai trò thành công', en: 'Role updated successfully' },
  
    // PAYMENT
    [SuccessCode.PAY_SUCCESS_001]: { vi: 'Thanh toán thành công', en: 'Payment successful' },
    [SuccessCode.PAY_SUCCESS_002]: { vi: 'Nạp tiền thành công. Số dư đã được cập nhật', en: 'Top-up successful. Balance updated' },
    [SuccessCode.PAY_SUCCESS_003]: { vi: 'Hoàn tiền thành công', en: 'Refund processed successfully' },
    [SuccessCode.PAY_SUCCESS_004]: { vi: 'Tạo hóa đơn thành công', en: 'Invoice generated successfully' },
  
    // REPORT
    [SuccessCode.REPORT_SUCCESS_001]: { vi: 'Tạo báo cáo thành công', en: 'Report generated successfully' },
    [SuccessCode.REPORT_SUCCESS_002]: { vi: 'Xuất báo cáo thành công (đã tải về)', en: 'Report exported successfully' },
    [SuccessCode.REPORT_SUCCESS_003]: { vi: 'Lên lịch báo cáo tự động thành công', en: 'Scheduled report created successfully' },
  
    // NOTIFICATION
    [SuccessCode.NOTI_SUCCESS_001]: { vi: 'Gửi thông báo thành công', en: 'Notification sent successfully' },
    [SuccessCode.NOTI_SUCCESS_002]: { vi: 'Đánh dấu tất cả thông báo đã đọc', en: 'All notifications marked as read' },
  });
  
  // Helper function
  export const getSuccessMessage = (code, lang = 'vi') => {
    return SuccessMessage[code]?.[lang] || SuccessMessage[SuccessCode.SUCCESS_000][lang];
  };