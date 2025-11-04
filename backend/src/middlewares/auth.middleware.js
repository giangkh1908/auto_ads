import { verifyAccessToken } from '../utils/jwt.js';
import User from '../models/user.model.js';
import UserRole from '../models/userRole.model.js';
import Role from '../models/role.model.js';
import Shop from '../models/shops/shop.model.js';
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

/**
 * 🔒 Middleware kiểm tra quyền truy cập trong shop cụ thể
 * @param {String} module - Tên module (ví dụ: "shop", "product")
 * @param {String} action - Hành động cụ thể (ví dụ: "create", "update", "delete", "view")
 */
export const authorizeInShop = (module, action) => {
  return async (req, res, next) => {
    try {
      const shopId = req.params.id || req.body.shop_id;
      const userId = req.user._id;

      if (!shopId) {
        return res.status(400).json({ 
          success: false,
          message: "Shop ID is required for this action." 
        });
      }

      // 1. Kiểm tra user có UserRole trong shop không
      let userRole = await UserRole.findOne({
        user_id: userId,
        shop_id: shopId,
      }).populate("role_id");

      // 2. Nếu không có UserRole, kiểm tra user có phải là owner không
      if (!userRole) {
        const shop = await Shop.findById(shopId);
        
        if (!shop) {
          return res.status(404).json({ 
            success: false,
            message: "Shop not found." 
          });
        }

        // Nếu user là owner, lấy role "Shop Owner" để kiểm tra permission
        if (shop.owner_id && shop.owner_id.toString() === userId.toString()) {
          const ownerRole = await Role.findOne({ role_name: "Shop Owner" });
          
          if (ownerRole) {
            // Tạo object giả để kiểm tra permission
            userRole = {
              role_id: ownerRole,
              shop_id: shopId,
            };
          } else {
            // Nếu không tìm thấy role "Shop Owner", cho phép owner luôn (bypass)
            req.shopId = shopId;
            return next();
          }
        } else {
          // User không phải owner và không có UserRole
          return res.status(403).json({ 
            success: false,
            message: "You are not part of this shop. ShopId: " + shopId + " UserId: " + userId 
          });
        }
      }

      // 3. Kiểm tra quyền
      const role = userRole.role_id;
      if (role && role.permissions) {
        const hasPermission = role.permissions.some(
          (perm) => perm.module === module && perm.actions.includes(action)
        );

        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: `Permission denied: You need '${module}.${action}' for this shop.`,
          });
        }
      }

      // Lưu shopId vào request để controller sử dụng
      req.shopId = shopId;
      
      next();
    } catch (error) {
      console.error("Authorization error:", error);
      return res.status(500).json({ 
        success: false,
        message: "Internal authorization error.",
        error: error.message 
      });
    }
  };
};