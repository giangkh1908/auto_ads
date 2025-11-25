// backend/src/middlewares/adminActionLogger.middleware.js
import { saveSystemLog, getClientIp, getUserAgent } from '../utils/systemLog.js';

/**
 * Middleware tự động ghi log tất cả các action của Admin users
 * (CS Staff, Accountant, System Admin)
 */
export const adminActionLogger = async (req, res, next) => {
  // Chỉ log nếu user có internal_role (admin user)
  if (!req.user?.internal_role) {
    return next();
  }

  const adminRoles = ['System Admin', 'CS Staff', 'Accountant'];
  if (!adminRoles.includes(req.user.internal_role)) {
    return next();
  }

  // Lưu original res.json để intercept response
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  
  let responseData = null;
  let statusCode = 200;

  // Intercept response để lấy data và status code
  res.json = function(data) {
    responseData = data;
    statusCode = res.statusCode;
    return originalJson(data);
  };

  res.send = function(data) {
    responseData = data;
    statusCode = res.statusCode;
    return originalSend(data);
  };

  // Xử lý sau khi response được gửi
  res.on('finish', async () => {
    try {
      // Bỏ qua các route không cần log (health check, static files, etc.)
      const skipRoutes = ['/health', '/api/system-logs'];
      if (skipRoutes.some(route => req.path.startsWith(route))) {
        return;
      }

      // Xác định action dựa trên method và route
      const action = getActionFromRoute(req.method, req.path);
      
      // Xác định category
      const category = getCategoryFromRoute(req.path);

      // Xác định target_type và target_name
      const { targetType, targetName } = getTargetInfo(req.path, req.params, responseData);

      // Xác định level và success
      const isSuccess = statusCode >= 200 && statusCode < 300;
      const level = isSuccess ? 'info' : (statusCode >= 500 ? 'error' : 'warning');

      // Tạo description
      const description = generateDescription(
        action,
        req.user.full_name || req.user.email,
        targetName,
        isSuccess,
        responseData?.message
      );

      // Lưu log (không await để không block response)
      saveSystemLog({
        category,
        level,
        action,
        description,
        user_id: req.user._id,
        user_name: req.user.full_name || req.user.email,
        internal_role: req.user.internal_role,
        ip_address: getClientIp(req),
        user_agent: getUserAgent(req),
        target_type: targetType,
        target_id: req.params.id || req.body?.id || null,
        target_name: targetName,
        request_data: sanitizeRequestData(req.body, req.query),
        response_data: sanitizeResponseData(responseData),
        success: isSuccess,
        error_message: isSuccess ? null : (responseData?.message || responseData?.error || 'Unknown error'),
      }).catch(err => {
        console.error('Error saving admin action log:', err);
      });
    } catch (error) {
      // Không throw error để không ảnh hưởng đến response
      console.error('Error in adminActionLogger middleware:', error);
    }
  });

  next();
};

/**
 * Xác định action từ method và route
 */
function getActionFromRoute(method, path) {
  // Check sub-routes trước (chi tiết hơn)
  if (path.includes('/assign')) {
    if (path.includes('/leads')) return 'LEAD_ASSIGNED';
    if (path.includes('/user-package')) return 'USER_PACKAGE_ASSIGNED';
    if (path.includes('/payment-transactions')) return 'PAYMENT_TRANSACTION_ASSIGNED';
  }
  
  if (path.includes('/status')) {
    if (path.includes('/leads')) return 'LEAD_STATUS_UPDATED';
  }

  if (path.includes('/set-method')) {
    return 'PAYMENT_METHOD_SET';
  }

  if (path.includes('/confirm-transfer')) {
    return 'PAYMENT_CONFIRMED';
  }

  // Route patterns chính
  if (path.startsWith('/api/leads')) {
    const actions = {
      'GET': 'LEAD_VIEWED',
      'POST': 'LEAD_CREATED',
      'PUT': 'LEAD_UPDATED',
      'DELETE': 'LEAD_DELETED',
    };
    return actions[method] || 'LEAD_ACTION';
  }

  if (path.startsWith('/api/user-package')) {
    const actions = {
      'GET': 'USER_PACKAGE_VIEWED',
      'POST': 'USER_PACKAGE_CREATED',
      'PUT': 'USER_PACKAGE_UPDATED',
      'DELETE': 'USER_PACKAGE_DELETED',
    };
    return actions[method] || 'USER_PACKAGE_ACTION';
  }

  if (path.startsWith('/api/payment-transactions')) {
    const actions = {
      'GET': 'PAYMENT_TRANSACTION_VIEWED',
      'POST': 'PAYMENT_TRANSACTION_CREATED',
      'PUT': 'PAYMENT_TRANSACTION_UPDATED',
      'PATCH': 'PAYMENT_TRANSACTION_UPDATED',
      'DELETE': 'PAYMENT_TRANSACTION_DELETED',
    };
    return actions[method] || 'PAYMENT_TRANSACTION_ACTION';
  }

  if (path.startsWith('/api/users')) {
    const actions = {
      'GET': 'USER_VIEWED',
      'POST': 'USER_CREATED',
      'PUT': 'USER_UPDATED',
      'PATCH': 'USER_UPDATED',
      'DELETE': 'USER_DELETED',
    };
    return actions[method] || 'USER_ACTION';
  }

  // Default action based on method
  const defaultActions = {
    'GET': 'DATA_VIEWED',
    'POST': 'DATA_CREATED',
    'PUT': 'DATA_UPDATED',
    'PATCH': 'DATA_UPDATED',
    'DELETE': 'DATA_DELETED',
  };

  return defaultActions[method] || 'UNKNOWN_ACTION';
}

/**
 * Xác định category từ route
 */
function getCategoryFromRoute(path) {
  if (path.includes('/leads')) return 'admin';
  if (path.includes('/user-package')) return 'admin';
  if (path.includes('/payment-transactions')) return 'admin';
  if (path.includes('/users')) return 'admin';
  if (path.includes('/admin')) return 'admin';
  return 'admin';
}

/**
 * Xác định target_type và target_name từ route và data
 */
function getTargetInfo(path, params, responseData) {
  let targetType = null;
  let targetName = null;

  if (path.includes('/leads')) {
    targetType = 'Lead';
    targetName = responseData?.data?.lead_name || params.id || 'Lead';
  } else if (path.includes('/user-package')) {
    targetType = 'UserPackage';
    targetName = responseData?.data?.package?.name || params.id || 'User Package';
  } else if (path.includes('/payment-transactions')) {
    targetType = 'PaymentTransaction';
    targetName = responseData?.data?.transactionId || params.id || 'Payment Transaction';
  } else if (path.includes('/users')) {
    targetType = 'User';
    targetName = responseData?.data?.full_name || responseData?.data?.email || params.id || 'User';
  }

  return { targetType, targetName };
}

/**
 * Tạo description tự động
 */
function generateDescription(action, userName, targetName, isSuccess, message) {
  const actionMap = {
    'LEAD_CREATED': `${userName} đã tạo lead mới`,
    'LEAD_VIEWED': `${userName} đã xem danh sách leads`,
    'LEAD_UPDATED': `${userName} đã cập nhật lead: ${targetName}`,
    'LEAD_DELETED': `${userName} đã xóa lead: ${targetName}`,
    'LEAD_ASSIGNED': `${userName} đã gán lead: ${targetName}`,
    'LEAD_STATUS_UPDATED': `${userName} đã cập nhật trạng thái lead: ${targetName}`,
    'USER_PACKAGE_VIEWED': `${userName} đã xem danh sách gói dịch vụ`,
    'USER_PACKAGE_UPDATED': `${userName} đã cập nhật gói dịch vụ: ${targetName}`,
    'USER_PACKAGE_CREATED': `${userName} đã tạo gói dịch vụ mới`,
    'USER_PACKAGE_DELETED': `${userName} đã xóa gói dịch vụ: ${targetName}`,
    'USER_PACKAGE_ASSIGNED': `${userName} đã gán gói dịch vụ: ${targetName}`,
    'PAYMENT_TRANSACTION_VIEWED': `${userName} đã xem danh sách giao dịch thanh toán`,
    'PAYMENT_TRANSACTION_UPDATED': `${userName} đã cập nhật giao dịch thanh toán: ${targetName}`,
    'PAYMENT_TRANSACTION_CREATED': `${userName} đã tạo giao dịch thanh toán mới`,
    'PAYMENT_TRANSACTION_DELETED': `${userName} đã xóa giao dịch thanh toán: ${targetName}`,
    'PAYMENT_TRANSACTION_ASSIGNED': `${userName} đã gán giao dịch thanh toán: ${targetName}`,
    'PAYMENT_METHOD_SET': `${userName} đã thiết lập phương thức thanh toán`,
    'PAYMENT_CONFIRMED': `${userName} đã xác nhận chuyển khoản`,
    'USER_VIEWED': `${userName} đã xem thông tin người dùng`,
    'USER_UPDATED': `${userName} đã cập nhật thông tin người dùng: ${targetName}`,
    'USER_CREATED': `${userName} đã tạo người dùng mới`,
    'USER_DELETED': `${userName} đã xóa người dùng: ${targetName}`,
    'DATA_VIEWED': `${userName} đã xem dữ liệu`,
    'DATA_CREATED': `${userName} đã tạo dữ liệu mới`,
    'DATA_UPDATED': `${userName} đã cập nhật dữ liệu`,
    'DATA_DELETED': `${userName} đã xóa dữ liệu`,
  };

  let description = actionMap[action] || `${userName} đã thực hiện hành động: ${action}`;
  
  if (!isSuccess && message) {
    description += ` - Lỗi: ${message}`;
  }

  return description;
}

/**
 * Sanitize request data để tránh lưu thông tin nhạy cảm
 */
function sanitizeRequestData(body, query) {
  const sensitiveFields = ['password', 'token', 'accessToken', 'refreshToken', 'secret'];
  const sanitized = { ...body, ...query };
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  });

  // Giới hạn kích thước
  const jsonStr = JSON.stringify(sanitized);
  if (jsonStr.length > 2000) {
    return { _truncated: true, _size: jsonStr.length };
  }

  return sanitized;
}

/**
 * Sanitize response data
 */
function sanitizeResponseData(data) {
  if (!data) return null;
  
  // Chỉ lưu success, message, và một số field quan trọng
  const sanitized = {
    success: data.success,
    message: data.message,
  };

  // Giới hạn kích thước
  const jsonStr = JSON.stringify(sanitized);
  if (jsonStr.length > 3000) {
    return { _truncated: true, _size: jsonStr.length };
  }

  return sanitized;
}

