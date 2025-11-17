// backend/src/utils/systemLog.js
import SystemLog from '../models/systemLogs.model.js';

/**
 * Helper function để lưu system log dễ dàng
 * Tự động format description dựa trên action
 */
export const saveSystemLog = async (logData) => {
  try {
    let description = logData.description;

    // Tự động tạo description nếu không có
    if (!description) {
      const userName = logData.user_name || 'Hệ thống';
      const targetName = logData.target_name || 'đối tượng';

      switch (logData.action) {
        case 'USER_LOGIN':
          description = `${userName} đã đăng nhập thành công`;
          break;
        case 'USER_LOGOUT':
          description = `${userName} đã đăng xuất`;
          break;
        case 'USER_REGISTER':
          description = `Người dùng mới đã đăng ký: ${logData.user_name || logData.target_name || 'Người dùng'}`;
          break;
        case 'PASSWORD_RESET_REQUEST':
          description = `${userName} đã yêu cầu đặt lại mật khẩu`;
          break;
        case 'PASSWORD_RESET_SUCCESS':
          description = `${userName} đã đặt lại mật khẩu thành công`;
          break;
        case 'EMAIL_VERIFIED':
          description = `${userName} đã xác nhận email thành công`;
          break;
        case 'USER_STATUS_UPDATED':
          description = `${userName} đã cập nhật trạng thái của ${targetName}`;
          break;
        case 'USER_CREATED':
          description = `${userName} đã tạo người dùng mới: ${targetName}`;
          break;
        case 'USER_UPDATED':
          description = `${userName} đã cập nhật thông tin người dùng: ${targetName}`;
          break;
        case 'USER_DELETED':
          description = `${userName} đã xóa người dùng: ${targetName}`;
          break;
        case 'PAYMENT_APPROVED':
          description = `${userName} đã duyệt thanh toán: ${targetName || 'Payment Transaction'}`;
          break;
        case 'PAYMENT_REJECTED':
          description = `${userName} đã từ chối thanh toán: ${targetName || 'Payment Transaction'}`;
          break;
        case 'AUTOMATION_RULE_EXECUTED':
          description = `Automation rule "${targetName || logData.meta?.rule_name || 'Rule'}" đã được thực thi`;
          break;
        case 'AUTOMATION_RULE_ERROR':
          description = `Lỗi khi thực thi automation rule: ${targetName || logData.meta?.rule_name || 'Rule'}`;
          break;
        case 'SCHEDULER_STARTED':
          description = 'Automation rule scheduler đã được khởi động';
          break;
        case 'SCHEDULER_STOPPED':
          description = 'Automation rule scheduler đã dừng';
          break;
        case 'LOGIN_FAILED':
          description = `Đăng nhập thất bại từ IP: ${logData.ip_address || 'Unknown'}`;
          break;
        default:
          description = logData.description || `${userName} đã thực hiện hành động: ${logData.action}`;
      }
    }

    // Lưu log
    return await SystemLog.logInfo({
      category: logData.category || 'system',
      level: logData.level || 'info',
      action: logData.action,
      description,
      user_id: logData.user_id,
      user_name: logData.user_name,
      internal_role: logData.internal_role,
      ip_address: logData.ip_address,
      user_agent: logData.user_agent,
      target_type: logData.target_type,
      target_id: logData.target_id,
      target_name: logData.target_name,
      request_data: logData.request_data,
      response_data: logData.response_data,
      success: logData.success !== undefined ? logData.success : true,
      error_message: logData.error_message,
      meta: logData.meta || {},
    });
  } catch (error) {
    // Không throw error để không block main flow
    console.error('Lỗi khi lưu system log:', error);
    return null;
  }
};

/**
 * Helper để lấy IP address từ request
 */
export const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'Unknown'
  );
};

/**
 * Helper để lấy user agent từ request
 */
export const getUserAgent = (req) => {
  return req.headers['user-agent'] || 'Unknown';
};
