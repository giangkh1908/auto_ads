import { verifyAccessToken } from '../utils/jwt.js';
import User from '../models/user.model.js';
import UserRole from '../models/userRole.model.js';
import Role from '../models/role.model.js';

/**
 * 🧩 Middleware xác thực Access Token
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Token không được cung cấp.' });
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT
    const decoded = verifyAccessToken(token);

    // Lấy thông tin user
    const user = await User.findById(decoded.id).select('-password -facebookAccessToken -facebookRefreshToken');

    if (!user || user.deleted_at) {
      return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc người dùng không tồn tại.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Tài khoản chưa được kích hoạt hoặc đã bị khóa.' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Vui lòng xác nhận email trước khi truy cập hệ thống.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Token không hợp lệ.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token đã hết hạn.' });
    }
    console.error('Auth middleware error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi xác thực hệ thống.' });
  }
};

/**
 * 🧩 Middleware xác thực Access Token cho SSE (từ query parameter)
 */
export const authenticateSSE = async (req, res, next) => {
  try {
    const token = req.query.token;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Token không được cung cấp.' });
    }

    // Verify JWT
    const decoded = verifyAccessToken(token);

    // Lấy thông tin user
    const user = await User.findById(decoded.id).select('-password -facebookAccessToken -facebookRefreshToken');

    if (!user || user.deleted_at) {
      return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc người dùng không tồn tại.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Tài khoản chưa được kích hoạt hoặc đã bị khóa.' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Vui lòng xác nhận email trước khi truy cập hệ thống.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Token không hợp lệ.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token đã hết hạn.' });
    }
    console.error('SSE Auth middleware error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi xác thực hệ thống.' });
  }
};

/**
 * 📨 Middleware kiểm tra email đã xác minh
 */
export const requireEmailVerification = (req, res, next) => {
  if (!req.user?.emailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Vui lòng xác nhận email trước khi sử dụng tính năng này.',
      code: 'EMAIL_NOT_VERIFIED',
    });
  }
  next();
};

/**
 * 🔒 Middleware kiểm tra quyền truy cập
 * @param {String} moduleName - Tên module (ví dụ: "campaign", "ads", "shop")
 * @param {String} action - Hành động cụ thể (ví dụ: "create", "update", "delete", "view")
 */
export const authorize = (moduleName, action) => {
  return async (req, res, next) => {
    try {
      const userId = req.user._id;
      const shopId = req.headers['x-shop-id'] || req.query.shop_id || null;

      const hasPermission = await UserRole.hasPermission(userId, shopId, moduleName, action);

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Bạn không có quyền ${action} trên module ${moduleName}.`,
        });
      }

      next();
    } catch (error) {
      console.error('Authorization error:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi kiểm tra phân quyền hệ thống.',
      });
    }
  };
};
