import User from "../../models/user/user.model.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import fetch from "node-fetch";
import axios from "axios";
import { generateTokens, verifyRefreshToken, getRefreshCookieMaxAge, verifyAccessToken, getRefreshExpirySeconds } from "../../utils/jwt.js";
import redis, { isRedisReady } from "../../config/redis.js";
import Shop from "../../models/shops/shop.model.js";
import ShopUser from "../../models/shops/shopUser.model.js";
import UserRole from "../../models/user/userRole.model.js";
import Role from "../../models/admin/role.model.js";
import UserSession from "../../models/user/userSession.model.js";
import { createDefaultShopAndRole } from "../../services/user/onboardingService.js";
import { ErrorCode, getErrorMessage } from "../../constants/errorCode.js";
import {
  queueVerificationEmail,
  queuePasswordResetEmail,
} from "../../services/email/emailService.js";
import { saveSystemLog, getClientIp, getUserAgent } from "../../utils/systemLog.js";

// Hàm xác thực CAPTCHA bằng axios
async function verifyCaptcha(token) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  const url = `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`;
  const response = await fetch(url, { method: "POST" });
  return response.json();
}

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 phút

const getLoginAttemptKey = (email) => `login:fail:${email.toLowerCase()}`;

async function checkLoginLockout(email) {
  if (!isRedisReady()) return { locked: false };
  try {
    const key = getLoginAttemptKey(email);
    const attempts = await redis.get(key);
    if (attempts && parseInt(attempts, 10) >= LOGIN_MAX_ATTEMPTS) {
      const ttl = await redis.ttl(key);
      return { locked: true, ttl };
    }
  } catch (err) {
    console.warn('[Auth] Redis lockout check failed, allowing login:', err.message);
  }
  return { locked: false };
}

async function recordFailedLogin(email) {
  if (!isRedisReady()) return;
  try {
    const key = getLoginAttemptKey(email);
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, Math.floor(LOGIN_LOCKOUT_MS / 1000));
    }
  } catch (err) {
    console.warn('[Auth] Redis failed login record failed:', err.message);
  }
}

async function resetFailedLogin(email) {
  if (!isRedisReady()) return;
  try {
    const key = getLoginAttemptKey(email);
    await redis.del(key);
  } catch (err) {
    console.warn('[Auth] Redis reset failed login failed:', err.message);
  }
}

// Đăng ký tài khoản
export const register = async (req, res) => {
  try {
    const { full_name, email, password, phone, captchaToken } = req.body;

    //Kiểm tra xem có điền đủ thông tin không
    if (!full_name || !email || !password || !phone)
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ thông tin.",
      });

    // Kiểm tra CAPTCHA
    if (!captchaToken) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng xác nhận CAPTCHA.",
      });
    }

    // Xác thực CAPTCHA với Google
    try {
      const captchaResult = await verifyCaptcha(captchaToken);

      if (!captchaResult.success) {
        console.log("CAPTCHA verification failed:", captchaResult.errorCodes);
        return res.status(400).json({
          success: false,
          message: "Xác thực CAPTCHA thất bại. Vui lòng thử lại.",
        });
      }

      console.log(
        "CAPTCHA verification successful for hostname:",
        captchaResult.hostname
      );
    } catch (captchaError) {
      console.error("CAPTCHA verification error:", captchaError.message);
      return res.status(400).json({
        success: false,
        message: "Lỗi xác thực CAPTCHA. Vui lòng thử lại.",
      });
    }

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({
        success: false,
        message: "Email này đã được đăng ký. Hãy tiến hành đăng nhập!",
      });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      full_name,
      email,
      password: hashed,
      phone,
      provider: "local",
      emailVerified: false,
      status: "pending",
    });

    // Tạo shop mặc định cho user mới
    const { shop, shopUser } = await createDefaultShopAndRole(user);
    console.log("Shop created:", shop._id, "ShopUser created:", shopUser._id);

    // Tạo token xác minh email
    const token = crypto.randomBytes(32).toString("hex");
    user.emailVerificationToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
    user.emailVerificationExpires = Date.now() + 3600000; // 1h
    await user.save();

    // Gửi email xác nhận
    queueVerificationEmail(email, full_name, token);

    // Log registration
    await saveSystemLog({
      category: 'auth',
      level: 'info',
      action: 'USER_REGISTER',
      user_id: user._id,
      user_name: user.full_name,
      target_type: 'User',
      target_id: user._id.toString(),
      target_name: user.full_name,
      ip_address: getClientIp(req),
      user_agent: getUserAgent(req),
      success: true,
    });

    res.status(201).json({
      success: true,
      message:
        "Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.",
    });
  } catch (error) {
    console.error("Lỗi đăng ký:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// Xác nhận email
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });
    if (!user)
      return res.status(400).json({
        success: false,
        message: "Email xác nhận không hợp lệ hoặc đã hết hạn.",
      });

    user.emailVerified = true;
    user.status = "active";
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    const { accessToken, refreshToken, refreshJti, familyId } = generateTokens(user._id, user.tokenVersion);

    // Tạo session mới
    await UserSession.createSession({
      userId: user._id,
      jti: refreshJti,
      familyId,
      device: {
        userAgent: getUserAgent(req),
        ip: getClientIp(req),
      },
    });

    // Log email verification
    await saveSystemLog({
      category: 'auth',
      level: 'success',
      action: 'EMAIL_VERIFIED',
      user_id: user._id,
      user_name: user.full_name,
      target_type: 'User',
      target_id: user._id.toString(),
      target_name: user.full_name,
      ip_address: getClientIp(req),
      user_agent: getUserAgent(req),
      success: true,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: getRefreshCookieMaxAge(),
    });

    res.status(200).json({
      success: true,
      message: "Xác nhận email thành công!",
      data: {
        user: {
          id: user._id,
          full_name: user.full_name,
          email: user.email,
          status: user.status,
        },
        tokens: { accessToken },
      },
    });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// Đăng nhập
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Kiểm tra account lockout
    const lockout = await checkLoginLockout(email);
    if (lockout.locked) {
      await saveSystemLog({
        category: 'security',
        level: 'warning',
        action: 'LOGIN_LOCKED',
        description: `Đăng nhập bị khóa do quá nhiều lần thử (${email})`,
        ip_address: getClientIp(req),
        user_agent: getUserAgent(req),
        success: false,
        error_message: `Account locked, ${lockout.ttl}s remaining`,
      });
      return res.status(429).json({
        success: false,
        message: `Tài khoản đã bị khóa tạm thời do quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau ${Math.ceil(lockout.ttl / 60)} phút.`,
        code: "ACCOUNT_LOCKED",
        retryAfter: lockout.ttl,
      });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      // Log failed login attempt
      await recordFailedLogin(email);
      await saveSystemLog({
        category: 'security',
        level: 'warning',
        action: 'LOGIN_FAILED',
        description: `Đăng nhập thất bại: Email không tồn tại (${email})`,
        ip_address: getClientIp(req),
        user_agent: getUserAgent(req),
        success: false,
        error_message: 'Email không tồn tại',
      });
      return res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không chính xác.",
      });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      // Log failed login attempt
      await recordFailedLogin(email);
      const attempts = await redis.get(getLoginAttemptKey(email));
      const remaining = LOGIN_MAX_ATTEMPTS - (parseInt(attempts, 10) || 0);
      // Log failed login attempt
      await saveSystemLog({
        category: 'security',
        level: 'warning',
        action: 'LOGIN_FAILED',
        description: `Đăng nhập thất bại: Mật khẩu không đúng cho user ${user.email}`,
        user_id: user._id,
        user_name: user.full_name,
        internal_role: user.internal_role,
        ip_address: getClientIp(req),
        user_agent: getUserAgent(req),
        success: false,
        error_message: 'Mật khẩu không đúng',
      });
      return res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không chính xác.",
        remainingAttempts: Math.max(0, remaining),
      });
    }
    // Kiểm tra status của user
    if (user.status === "inactive") {
      // Log failed login attempt
      await saveSystemLog({
        category: 'security',
        level: 'warning',
        action: 'LOGIN_FAILED',
        description: `Đăng nhập thất bại: Tài khoản đã bị vô hiệu hoá (${user.email})`,
        user_id: user._id,
        user_name: user.full_name,
        internal_role: user.internal_role,
        ip_address: getClientIp(req),
        user_agent: getUserAgent(req),
        success: false,
        error_message: 'Tài khoản đã bị vô hiệu hoá',
      });
      return res.status(403).json({
        success: false,
        error: {
          code: ErrorCode.AUTH_010,
          message: getErrorMessage(ErrorCode.AUTH_010, 'vi'),
        },
        status: 'inactive',
      });
    }

    if (user.status === "banned") {
      // Log failed login attempt
      await saveSystemLog({
        category: 'security',
        level: 'warning',
        action: 'LOGIN_FAILED',
        description: `Đăng nhập thất bại: Tài khoản đã bị cấm (${user.email})`,
        user_id: user._id,
        user_name: user.full_name,
        internal_role: user.internal_role,
        ip_address: getClientIp(req),
        user_agent: getUserAgent(req),
        success: false,
        error_message: 'Tài khoản đã bị cấm',
      });
      return res.status(403).json({
        success: false,
        error: {
          code: ErrorCode.AUTH_011,
          message: getErrorMessage(ErrorCode.AUTH_011, 'vi'),
        },
        status: 'banned',
      });
    }

    if (user.status !== "active") {
      // Các status khác (pending, etc.)
      await saveSystemLog({
        category: 'security',
        level: 'warning',
        action: 'LOGIN_FAILED',
        description: `Đăng nhập thất bại: Tài khoản chưa được kích hoạt (${user.email})`,
        user_id: user._id,
        user_name: user.full_name,
        internal_role: user.internal_role,
        ip_address: getClientIp(req),
        user_agent: getUserAgent(req),
        success: false,
        error_message: 'Tài khoản chưa được kích hoạt',
      });
      return res
        .status(403)
        .json({ success: false, message: "Tài khoản chưa được kích hoạt." });
    }

    const { accessToken, refreshToken, refreshJti, familyId } = generateTokens(user._id, user.tokenVersion);

    // Tạo session mới
    await UserSession.createSession({
      userId: user._id,
      jti: refreshJti,
      familyId,
      device: {
        userAgent: getUserAgent(req),
        ip: getClientIp(req),
      },
    });

    user.password = undefined;

    // Log successful login
    await saveSystemLog({
      category: 'auth',
      level: 'success',
      action: 'USER_LOGIN',
      user_id: user._id,
      user_name: user.full_name,
      internal_role: user.internal_role,
      target_type: 'User',
      target_id: user._id.toString(),
      target_name: user.full_name,
      ip_address: getClientIp(req),
      user_agent: getUserAgent(req),
      success: true,
    });

    // Reset failed login counter on success
    await resetFailedLogin(user.email);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: getRefreshCookieMaxAge(),
    });

    res.status(200).json({
      success: true,
      message: "Đăng nhập thành công!",
      data: {
        user,
        tokens: { accessToken },
      },
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// Login via Facebook
export const facebookLogin = async (req, res) => {
  try {
    console.log("Bắt đầu đăng nhập bằng Facebook");

    const { accessToken } = req.body;
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: "Thiếu access token.",
      });
    }

    console.log("Đang xác thực ...");

    // Lấy thông tin user từ Facebook Graph API — facebookId luôn từ server-side
    const fbResp = await fetch(
      `https://graph.facebook.com/me?access_token=${accessToken}&fields=id,name,email,picture.width(200).height(200)`
    );
    const fbData = await fbResp.json();

    if (!fbData.id) {
      await saveSystemLog({
        category: 'security',
        level: 'warning',
        action: 'FACEBOOK_LOGIN_FAILED',
        description: `Đăng nhập Facebook thất bại: Không lấy được Facebook ID từ Graph API`,
        ip_address: getClientIp(req),
        user_agent: getUserAgent(req),
        success: false,
        error_message: 'Facebook Graph API returned no ID',
      });
      return res
        .status(400)
        .json({ success: false, message: "Xác thực Facebook thất bại." });
    }

    const facebookId = fbData.id;

    // Đổi short-lived token thành long-lived token
    let longLivedToken = accessToken;
    try {
      const tokenResp = await fetch(
        `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FB_APP_ID}&client_secret=${process.env.FB_APP_SECRET}&fb_exchange_token=${accessToken}`
      );
      const tokenData = await tokenResp.json();
      if (tokenData.access_token) {
        longLivedToken = tokenData.access_token;
        console.log("Đã đổi thành long-lived token");
      }
    } catch (tokenError) {
      console.log(
        "Không thể đổi token, sử dụng token gốc:",
        tokenError.message
      );
    }

    let user = await User.findOne({
      $or: [{ facebookId }, { email: fbData.email }],
    });
    if (!user) {
      user = await User.create({
        full_name: fbData.name,
        email: fbData.email || `${fbData.id}@facebook.com`,
        facebookId: fbData.id,
        provider: "facebook",
        avatar: fbData.picture?.data?.url || null,
        facebookAccessToken: longLivedToken,
        emailVerified: true,
        status: "active",
      });

      // Tạo shop mặc định cho user Facebook lần đầu
      const { shop, shopUser } = await createDefaultShopAndRole(user);
      console.log("✅ ShopUser created for Facebook user:", shopUser._id);
      console.log("✅ UserRole created for Facebook user");

      // Log Facebook registration (new user created)
      await saveSystemLog({
        category: 'auth',
        level: 'info',
        action: 'USER_REGISTER',
        description: `Người dùng đã đăng ký qua Facebook: ${user.full_name}`,
        user_id: user._id,
        user_name: user.full_name,
        target_type: 'User',
        target_id: user._id.toString(),
        target_name: user.full_name,
        ip_address: getClientIp(req),
        user_agent: getUserAgent(req),
        success: true,
        meta: {
          provider: 'facebook',
          facebookId: user.facebookId,
        },
      });
    } else {
      // User đã tồn tại - kiểm tra status trước khi cho phép đăng nhập
      if (user.status === "inactive") {
        await saveSystemLog({
          category: 'security',
          level: 'warning',
          action: 'FACEBOOK_LOGIN_FAILED',
          description: `Đăng nhập Facebook thất bại: Tài khoản đã bị vô hiệu hoá (${user.email})`,
          user_id: user._id,
          user_name: user.full_name,
          internal_role: user.internal_role,
          ip_address: getClientIp(req),
          user_agent: getUserAgent(req),
          success: false,
          error_message: 'Tài khoản đã bị vô hiệu hoá',
        });
        return res.status(403).json({
          success: false,
          error: {
            code: ErrorCode.AUTH_010,
            message: getErrorMessage(ErrorCode.AUTH_010, 'vi'),
          },
          status: 'inactive',
        });
      }

      if (user.status === "banned") {
        await saveSystemLog({
          category: 'security',
          level: 'warning',
          action: 'FACEBOOK_LOGIN_FAILED',
          description: `Đăng nhập Facebook thất bại: Tài khoản đã bị cấm (${user.email})`,
          user_id: user._id,
          user_name: user.full_name,
          internal_role: user.internal_role,
          ip_address: getClientIp(req),
          user_agent: getUserAgent(req),
          success: false,
          error_message: 'Tài khoản đã bị cấm',
        });
        return res.status(403).json({
          success: false,
          error: {
            code: ErrorCode.AUTH_011,
            message: getErrorMessage(ErrorCode.AUTH_011, 'vi'),
          },
          status: 'banned',
        });
      }

      // Cập nhật thông tin user
      user.avatar = fbData.picture?.data?.url || user.avatar;
      user.facebookAccessToken = longLivedToken;
      user.last_login_at = Date.now();
      user.facebookId = fbData.id; // Cập nhật facebookId nếu chưa có
      
      // Cập nhật status thành "active" nếu đang là "pending" (đăng nhập Facebook = đã xác thực)
      if (user.status === "pending") {
        user.status = "active";
        user.emailVerified = true;
      }
      
      await user.save();
      console.log("Đăng nhập thành công");

      // Kiểm tra xem user có ShopUser và UserRole hay chưa
      const existingShopUser = await ShopUser.findOne({
        user_id: user._id,
        removed_at: null,
      });

      const existingUserRole = await UserRole.findOne({
        user_id: user._id,
        revoked_at: null,
      });

      // Nếu chưa có ShopUser hoặc UserRole, tạo mới
      if (!existingShopUser || !existingUserRole) {
        console.log("⚠️ User thiếu ShopUser hoặc UserRole, đang tạo mới...");

        // Tìm shop hiện có (nếu có) hoặc tạo mới
        let shop = await Shop.findOne({
          owner_id: user._id,
          deleted_at: null,
        });

        if (!shop) {
          // Tạo shop mặc định
          shop = await Shop.create({
            shop_name: user.full_name || fbData.name,
            owner_id: user._id,
            status: "active",
            settings: {
              currency: "VND",
              timezone: "Asia/Ho_Chi_Minh",
              language: "vi",
            },
            created_by: user._id,
            updated_by: user._id,
          });
          console.log("✅ Shop created for existing Facebook user:", shop._id);
        }

        // Tạo ShopUser nếu chưa có
        if (!existingShopUser) {
          const shopUser = await ShopUser.create({
            user_id: user._id,
            shop_id: shop._id,
            is_manager: true,
            status: "active",
          });
          console.log("✅ ShopUser created for existing Facebook user:", shopUser._id);

          // Tạo UserRole nếu chưa có
          if (!existingUserRole) {
            const ownerRole = await Role.findOne({ role_name: "Shop Owner" });
            if (ownerRole) {
              await UserRole.create({
                user_id: user._id,
                role_id: ownerRole._id,
                shop_id: shop._id,
                shop_user_id: shopUser._id,
                is_current: true,
                source: "system",
              });
              console.log("✅ UserRole created for existing Facebook user");
            }
          }
        } else if (!existingUserRole) {
          // Chỉ thiếu UserRole
          const ownerRole = await Role.findOne({ role_name: "Shop Owner" });
          if (ownerRole) {
            await UserRole.create({
              user_id: user._id,
              role_id: ownerRole._id,
              shop_id: existingShopUser.shop_id,
              shop_user_id: existingShopUser._id,
              is_current: true,
              source: "system",
            });
            console.log("✅ UserRole created for existing Facebook user");
          }
        }
      }
    }

    console.log("Fetching user's Facebook Pages...");
    let pages = [];

    try {
      const pagesResp = await fetch(
        `https://graph.facebook.com/me/accounts?fields=id,name,category,access_token,tasks&access_token=${accessToken}`
      );
      const pagesData = await pagesResp.json();

      if (pagesData.data) {
        pages = pagesData.data.map((page) => ({
          id: page.id,
          name: page.name,
          category: page.category,
          pageAccessToken: page.access_token,
          tasks: page.tasks || [],
        }));
        console.log(`Found ${pages.length} pages.`);
      } else {
        console.log("No pages found or missing permission:", pagesData);
      }
    } catch (pageError) {
      console.error("Failed to fetch Facebook Pages:", pageError);
    }

    // Tạo token đăng nhập
    const { accessToken: at, refreshToken: rt, refreshJti, familyId } = generateTokens(user._id, user.tokenVersion);

    // Tạo session mới
    await UserSession.createSession({
      userId: user._id,
      jti: refreshJti,
      familyId,
      device: {
        userAgent: getUserAgent(req),
        ip: getClientIp(req),
      },
    });

    // Log successful Facebook login
    await saveSystemLog({
      category: 'auth',
      level: 'success',
      action: 'USER_LOGIN',
      description: `${user.full_name} đã đăng nhập thành công qua Facebook`,
      user_id: user._id,
      user_name: user.full_name,
      internal_role: user.internal_role,
      target_type: 'User',
      target_id: user._id.toString(),
      target_name: user.full_name,
      ip_address: getClientIp(req),
      user_agent: getUserAgent(req),
      success: true,
      meta: {
        provider: 'facebook',
        facebookId: user.facebookId,
      },
    });

    res.cookie('refreshToken', rt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: getRefreshCookieMaxAge(),
    });

    // Gửi trả về FE cả user, tokens và pages
    return res.status(200).json({
      success: true,
      message: "Đăng nhập Facebook thành công.",
      data: { user, tokens: { accessToken: at }, pages },
    });
  } catch (error) {
    console.error("Facebook login error:", error);
    
    // Log Facebook login error
    await saveSystemLog({
      category: 'auth',
      level: 'error',
      action: 'FACEBOOK_LOGIN_ERROR',
      description: `Lỗi khi đăng nhập Facebook: ${error.message || 'Lỗi hệ thống'}`,
      ip_address: getClientIp(req),
      user_agent: getUserAgent(req),
      success: false,
      error_message: error.message,
      error_stack: error.stack?.substring(0, 2000),
    });
    
    return res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// Làm mới token — rotation + family tracking
export const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token không được cung cấp.",
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    const { id: userId, jti, tv: tokenVersion, fid: familyId } = decoded;

    const user = await User.findById(userId).select("+tokenVersion");
    if (!user) {
      return res.status(401).json({ success: false, message: "Refresh token không hợp lệ." });
    }

    // Check token version — invalidate nếu password change / force logout
    if (tokenVersion !== user.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: "Token đã lỗi thời. Vui lòng đăng nhập lại.",
        code: "TOKEN_VERSION_MISMATCH",
      });
    }

    // Check user status — deny nếu bị ban/inactive sau khi token được cấp
    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản đã bị khóa hoặc chưa kích hoạt.",
        code: "ACCOUNT_INACTIVE",
      });
    }

    // Family tracking: kiểm tra replay attack (graceful degradation if Redis down)
    const redisKey = `refresh:${jti}`;
    let wasUsed = null;
    try {
      if (isRedisReady()) {
        wasUsed = await redis.get(redisKey);
      }
    } catch (redisErr) {
      console.warn('[Auth] Redis replay check failed, proceeding:', redisErr.message);
    }

    if (wasUsed === "used") {
      // Replay attack detected — revoke toàn bộ family
      await UserSession.revokeByFamily(familyId);
      user.status = "inactive";
      await user.save();

      await saveSystemLog({
        category: "security",
        level: "critical",
        action: "REFRESH_TOKEN_REPLAY",
        user_id: userId,
        user_name: user.full_name,
        description: `Replay attack detected — family ${familyId.slice(0, 8)} revoked`,
        ip_address: getClientIp(req),
        success: false,
      });

      return res.status(401).json({
        success: false,
        message: "Phát hiện tấn công token. Tài khoản đã bị khóa.",
        code: "TOKEN_REPLAY_DETECTED",
      });
    }

    // Mark current token as used (rotation)
    try {
      const ttl = getRefreshExpirySeconds();
      if (isRedisReady()) {
        await redis.set(redisKey, "used", "EX", ttl);
      }
    } catch (redisErr) {
      console.warn('[Auth] Redis rotation mark failed, proceeding:', redisErr.message);
    }

    // Tạo token mới với cùng familyId
    const { accessToken, refreshToken: newRefreshToken, refreshJti } = generateTokens(user._id, user.tokenVersion, familyId);

    // Update session
    await UserSession.findOneAndUpdate(
      { jti, user_id: userId },
      { $set: { isActive: false, revokedAt: new Date() } }
    );
    await UserSession.createSession({
      userId,
      jti: refreshJti,
      familyId,
      device: {
        userAgent: req.headers["user-agent"],
        ip: getClientIp(req),
      },
    });

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: getRefreshCookieMaxAge(),
    });

    res.status(200).json({
      success: true,
      message: "Làm mới token thành công.",
      data: { tokens: { accessToken } },
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Refresh token hết hạn hoặc không hợp lệ.",
    });
  }
};

// Quên mật khẩu
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Luôn trả về message giống nhau — tránh email enumeration
    const genericMessage = "Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.";

    if (!user) {
      return res.status(200).json({ success: true, message: genericMessage });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.passwordResetExpires = Date.now() + 3600000; // 1 giờ
    await user.save({ validateBeforeSave: false });

    queuePasswordResetEmail(email, user.full_name, resetToken);

    // Log password reset request
    await saveSystemLog({
      category: 'auth',
      level: 'info',
      action: 'PASSWORD_RESET_REQUEST',
      user_id: user._id,
      user_name: user.full_name,
      internal_role: user.internal_role,
      target_type: 'User',
      target_id: user._id.toString(),
      target_name: user.full_name,
      ip_address: getClientIp(req),
      user_agent: getUserAgent(req),
      success: true,
    });

    res
      .status(200)
      .json({ success: true, message: genericMessage });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// Reset password
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });
    if (!user)
      return res.status(400).json({
        success: false,
        message: "Token không hợp lệ hoặc đã hết hạn.",
      });

    user.password = await bcrypt.hash(password, 10);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    // Increment tokenVersion → invalidate tất cả token cũ
    user.tokenVersion = (user.tokenVersion || 1) + 1;
    await user.save();

    // Thu hồi tất cả sessions — buộc đăng nhập lại ở mọi thiết bị
    await UserSession.updateMany(
      { user_id: user._id, isActive: true },
      { isActive: false, revokedAt: new Date() }
    );

    // Log password reset success
    await saveSystemLog({
      category: 'auth',
      level: 'success',
      action: 'PASSWORD_RESET_SUCCESS',
      user_id: user._id,
      user_name: user.full_name,
      internal_role: user.internal_role,
      target_type: 'User',
      target_id: user._id.toString(),
      target_name: user.full_name,
      ip_address: getClientIp(req),
      user_agent: getUserAgent(req),
      success: true,
    });

    res
      .status(200)
      .json({ success: true, message: "Đặt lại mật khẩu thành công!" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// Lấy thông tin user hiện tại
export const getCurrentUser = async (req, res) => {
  try {
    const user = req.user;
    let shop = null;
    let shopId = null;
    let shopUser = null;

    // Tối ưu hóa: Chạy song song tìm UserRole hiện tại và Shop do user làm owner
    const [currentUserRole, fallbackOwnerShop] = await Promise.all([
      UserRole.findOne({
        user_id: user._id,
        is_current: true,
        shop_id: { $exists: true, $ne: null },
        revoked_at: null,
      }).lean(),
      Shop.findOne({
        owner_id: user._id,
        deleted_at: null,
      }).lean()
    ]);

    if (currentUserRole?.shop_id) {
      shopId = currentUserRole.shop_id;
      // Nếu shop hiện tại trùng với shop do user sở hữu, dùng luôn thông tin đã fetch song song trước đó để giảm 1 query
      if (fallbackOwnerShop && fallbackOwnerShop._id.toString() === shopId.toString()) {
        shop = fallbackOwnerShop;
      } else {
        shop = await Shop.findOne({
          _id: shopId,
          deleted_at: null,
        }).lean();
      }
    } else {
      shop = fallbackOwnerShop;
      if (shop) {
        shopId = shop._id;
      }
    }

    if (shopId) {
      shopUser = await ShopUser.findOne({
        user_id: user._id,
        shop_id: shopId,
        status: "active",
      }).lean();
    }

    // Thêm shop_id vào user object để frontend dùng
    const userWithShop = {
      ...user.toObject(),
      shop_id: shopId,
    };

    return res.status(200).json({
      success: true,
      data: {
        user: userWithShop,
        shop, // ✅ Shop model có facebook_pages (nguồn chính)
        shopUser,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// Cập nhật profile
export const updateProfile = async (req, res) => {
  try {
    const { full_name, phone, country, profile } = req.body; // thêm country
    const user = await User.findById(req.user._id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy user." });

    if (full_name) user.full_name = full_name;
    if (phone) user.phone = phone;
    if (typeof country === "string") user.country = country; // cập nhật country
    if (profile) user.profile = { ...user.profile, ...profile };

    await user.save();
    res.status(200).json({
      success: true,
      message: "Cập nhật thông tin thành công!",
      data: { user: user.toJSON() },
    });
  } catch (error) {
    console.log("Update profile error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// Đổi mật khẩu
export const changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.",
      });
    }

    const user = await User.findById(userId).select("+password");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu hiện tại không chính xác.",
      });
    }

    if (await bcrypt.compare(newPassword, user.password)) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới không được trùng với mật khẩu hiện tại.",
      });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    // Increment tokenVersion → invalidate tất cả token cũ
    user.tokenVersion = (user.tokenVersion || 1) + 1;
    await user.save();

    // Thu hồi tất cả sessions — buộc đăng nhập lại ở mọi thiết bị
    await UserSession.updateMany(
      { user_id: userId, isActive: true },
      { isActive: false, revokedAt: new Date() }
    );

    res.status(200).json({
      success: true,
      message: "Đổi mật khẩu thành công!",
      requireLogout: true,
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống.",
    });
  }
};

// Gửi lại email xác nhận
export const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email là bắt buộc.",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email này đã được xác minh rồi.",
      });
    }

    // Tạo token mới
    const token = crypto.randomBytes(32).toString("hex");
    user.emailVerificationToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
    user.emailVerificationExpires = Date.now() + 3600000; // 1 giờ
    await user.save({ validateBeforeSave: false });

    // Gửi lại email xác minh
    queueVerificationEmail(user.email, user.full_name, token);

    res.status(200).json({
      success: true,
      message:
        "Email xác nhận đã được gửi lại! Vui lòng kiểm tra hộp thư của bạn.",
    });
  } catch (error) {
    console.error("resendVerificationEmail error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống.",
    });
  }
};

// Logout
export const logout = async (req, res) => {
  try {
    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    // Blacklist access token + revoke session
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = verifyAccessToken(token);
        if (decoded?.jti && decoded?.exp) {
          const ttl = decoded.exp - Math.floor(Date.now() / 1000);
          if (ttl > 0 && isRedisReady()) {
            await redis.set(`blacklist:${decoded.jti}`, '1', 'EX', ttl);
          }
        }
      } catch (e) { /* ignore decode errors — token may already be expired */ }
    }

    // Revoke current session nếu có refresh token
    const rtCookie = req.cookies.refreshToken;
    if (rtCookie) {
      try {
        const rtDecoded = verifyRefreshToken(rtCookie);
        await UserSession.revokeByJti(rtDecoded.jti);
        if (isRedisReady()) {
          await redis.del(`refresh:${rtDecoded.jti}`);
        }
      } catch (e) { /* ignore */ }
    }

    // Log logout if user is authenticated
    if (req.user) {
      await saveSystemLog({
        category: 'auth',
        level: 'info',
        action: 'USER_LOGOUT',
        user_id: req.user._id,
        user_name: req.user.full_name,
        internal_role: req.user.internal_role,
        target_type: 'User',
        target_id: req.user._id.toString(),
        target_name: req.user.full_name,
        ip_address: getClientIp(req),
        user_agent: getUserAgent(req),
        success: true,
      });
    }
  } catch (error) {
    console.error('Error logging logout:', error);
  }
  res.status(200).json({ success: true, message: "Đăng xuất thành công." });
};

// Link Facebook account to existing user (không tạo user mới)
export const linkFacebook = async (req, res) => {
  try {
    const currentUser = req.user;
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: "Thiếu access token.",
      });
    }

    // Xác thực Facebook token — facebookId luôn từ server-side
    const fbResp = await axios.get(
      `https://graph.facebook.com/me?access_token=${accessToken}&fields=id,name,email,picture.width(200).height(200)`
    );
    const fbData = fbResp.data;

    if (!fbData.id) {
      return res.status(400).json({
        success: false,
        message: "Xác thực Facebook thất bại.",
      });
    }

    const facebookId = fbData.id;

    // Kiểm tra facebookId đã được sử dụng bởi user khác chưa
    const existingUser = await User.findOne({ facebookId });
    if (existingUser && existingUser._id.toString() !== currentUser._id.toString()) {
      await saveSystemLog({
        category: 'security',
        level: 'warning',
        action: 'FACEBOOK_LINK_FAILED',
        description: `Liên kết Facebook thất bại: Facebook ID đã được sử dụng bởi user khác (${existingUser.email})`,
        user_id: currentUser._id,
        user_name: currentUser.full_name,
        ip_address: getClientIp(req),
        user_agent: getUserAgent(req),
        success: false,
        error_message: 'Facebook account already bound to another user',
      });

      return res.status(400).json({
        success: false,
        error: {
          code: "FACEBOOK_ALREADY_BOUND",
          message: "Tài khoản Facebook này đã được liên kết với tài khoản khác. Vui lòng sử dụng tài khoản Facebook khác.",
        },
      });
    }

    // Đổi short-lived token thành long-lived token
    let longLivedToken = accessToken;
    try {
      const tokenResp = await axios.get(
        `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FB_APP_ID}&client_secret=${process.env.FB_APP_SECRET}&fb_exchange_token=${accessToken}`
      );
      if (tokenResp.data?.access_token) {
        longLivedToken = tokenResp.data.access_token;
      }
    } catch (tokenError) {
      console.log("Không thể đổi token, sử dụng token gốc:", tokenError.message);
    }

    // Cập nhật thông tin Facebook cho user hiện tại
    const user = await User.findById(currentUser._id);
    user.facebookId = fbData.id;
    user.facebookAccessToken = longLivedToken;
    user.avatar = user.avatar || fbData.picture?.data?.url;
    await user.save();

    // Lấy danh sách pages
    let pages = [];
    try {
      const pagesResp = await axios.get(
        `https://graph.facebook.com/me/accounts?fields=id,name,category,access_token,tasks&access_token=${accessToken}`
      );

      if (pagesResp.data?.data) {
        pages = pagesResp.data.data.map((page) => ({
          id: page.id,
          name: page.name,
          category: page.category,
          pageAccessToken: page.access_token,
          tasks: page.tasks || [],
        }));
      }
    } catch (pageError) {
      console.error("Failed to fetch Facebook Pages:", pageError);
    }

    // Log successful Facebook link
    await saveSystemLog({
      category: 'auth',
      level: 'success',
      action: 'FACEBOOK_LINKED',
      description: `${user.full_name} đã liên kết tài khoản Facebook thành công`,
      user_id: user._id,
      user_name: user.full_name,
      target_type: 'User',
      target_id: user._id.toString(),
      target_name: user.full_name,
      ip_address: getClientIp(req),
      user_agent: getUserAgent(req),
      success: true,
      meta: {
        facebookId: user.facebookId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Liên kết tài khoản Facebook thành công.",
      data: { user, pages },
    });
  } catch (error) {
    console.error("Link Facebook error:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};