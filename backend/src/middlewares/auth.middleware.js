import { verifyAccessToken } from '../utils/jwt.js';
import redis from '../config/redis.js';
import User from '../models/user/user.model.js';
import UserRole from '../models/user/userRole.model.js';
import Role from '../models/admin/role.model.js';
import Shop from '../models/shops/shop.model.js';
import UserPackage from "../models/package/userPackage.model.js"
import ShopUser from "../models/shops/shopUser.model.js"

async function authenticateWithToken(token, req, res, next) {
  try {
    const decoded = verifyAccessToken(token);

    // Check token blacklist
    if (decoded.jti) {
      const isBlacklisted = await redis.get(`blacklist:${decoded.jti}`);
      if (isBlacklisted) {
        return res.status(401).json({ success: false, message: 'Token đã bị thu hồi.' });
      }
    }

    // Check token version
    const user = await User.findById(decoded.id).select({
      password: 0,
      facebookAccessToken: 0,
      facebookRefreshToken: 0
    });
    if (!user || user.deleted_at) {
      return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc người dùng không tồn tại.' });
    }

    if (decoded.tv !== user.tokenVersion) {
      return res.status(401).json({ success: false, message: 'Token đã lỗi thời. Vui lòng đăng nhập lại.' });
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
      return res.status(401).json({
        success: false,
        message: 'Token đã hết hạn.',
        code: 'TOKEN_EXPIRED'
      });
    }
    console.error('Auth middleware error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi xác thực hệ thống.' });
  }
}

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token không được cung cấp.' });
  }
  const token = authHeader.split(' ')[1];
  return authenticateWithToken(token, req, res, next);
};

export const authenticateSSE = async (req, res, next) => {
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Token không được cung cấp.' });
  }
  return authenticateWithToken(token, req, res, next);
};

/**
 * Middleware kiểm tra email đã xác minh
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
 * Middleware kiểm tra quyền truy cập
 * @param {String} moduleName - Tên module (ví dụ: "campaign", "ads", "shop")
 * @param {String} action - Hành động cụ thể (ví dụ: "create", "update", "delete", "view")
 */
export const authorize = (moduleName, action) => {
  return async (req, res, next) => {
    try {
      // System Admin có quyền truy cập tất cả
      if (req.user.internal_role === "System Admin") {
        return next();
      }

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
 * Middleware kiểm tra quyền truy cập trong shop cụ thể
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

export const checkFeature = (feature) => {
  return async (req, res, next) => {
    try {
      const subscription = await Subscription.findOne({
        user_id: req.user._id,
        status: "active"
      }).populate("package_id");

      if (!subscription) {
        return res.status(403).json({ message: "Không có gói dịch vụ" });
      }

      const hasFeature = subscription.package_id.features.includes(feature);
      if (!hasFeature) {
        return res.status(403).json({ message: "Tính năng không khả dụng trong gói của bạn" });
      }

      req.subscription = subscription; // truyền tiếp
      next();
    } catch (err) {
      res.status(500).json({ message: "Lỗi server" });
    }
  };
};

export const checkPackageLimit = (resource) => {
  return async (req, res, next) => {
    try {
      const userPackage = await UserPackage.findOne({
        user_id: req.user._id,
        status: "active",
      });

      if (!userPackage) {
        return res.status(403).json({ message: "Không có gói dịch vụ" });
      }

      const limit = userPackage[resource];
      let used = 0;

      if (resource === "shops") {
        used = await Shop.countDocuments({ owner_id: req.user._id, deleted_at: null });
      } else if (resource === "employees") {
        const shopIds = await Shop.find({ owner_id: req.user._id }).distinct("_id");
        used = await ShopUser.countDocuments({
          shop_id: { $in: shopIds },
          user_id: { $ne: req.user._id },
          status: "active",
        });
      }

      if (used >= limit) {
        return res.status(403).json({
          message: `Đã đạt giới hạn ${resource}: ${used}/${limit}`,
        });
      }

      req.packageLimit = { limit, used };
      next();
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };
};