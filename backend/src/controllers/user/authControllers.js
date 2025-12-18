import User from "../../models/user/user.model.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import fetch from "node-fetch";
import axios from "axios";
import { generateTokens, verifyRefreshToken } from "../../utils/jwt.js";
import Shop from "../../models/shops/shop.model.js";
import ShopUser from "../../models/shops/shopUser.model.js";
import UserRole from "../../models/user/userRole.model.js";
import { RoleEnum } from "../../constants/enum.js";
import { ErrorCode, getErrorMessage } from "../../constants/errorCode.js";
import {
  queueVerificationEmail,
  queuePasswordResetEmail,
} from "../../services/email/emailService.js";
import jwt from "jsonwebtoken";
import { saveSystemLog, getClientIp, getUserAgent } from "../../utils/systemLog.js";

// Hàm xác thực CAPTCHA bằng axios
async function verifyCaptcha(token) {
  try {
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) {
      throw new Error("RECAPTCHA_SECRET_KEY not configured");
    }

    const response = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`
    );

    return {
      success: response.data.success,
      errorCodes: response.data["error-codes"] || [],
      hostname: response.data.hostname,
    };
  } catch (error) {
    console.error("CAPTCHA verification request failed:", error.message);
    throw error;
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
    const shop = await Shop.create({
      shop_name: full_name,
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
    console.log("Shop created:", shop._id);

    // Tạo ShopUser với status "active" để được tính vào employee count
    let shopUser;
    try {
      shopUser = await ShopUser.create({
        user_id: user._id,
        shop_id: shop._id,
        is_manager: true,
        status: "active", // Đảm bảo status là "active" để được tính vào employee count
      });
      console.log("ShopUser created:", shopUser._id);
    } catch (shopUserError) {
      console.error("Error creating ShopUser:", shopUserError);
      console.error("ShopUser error details:", {
        message: shopUserError.message,
        code: shopUserError.code,
        keyPattern: shopUserError.keyPattern,
        keyValue: shopUserError.keyValue,
      });
      throw shopUserError;
    }

    // Tạo UserRole với role Shop Owner
    try {
      await UserRole.create({
        user_id: user._id,
        role_id: RoleEnum.SHOP_OWNER,
        shop_id: shop._id,
        shop_user_id: shopUser._id,
        is_current: true,
        source: "system", // Đánh dấu là được tạo tự động từ hệ thống
      });
      console.log("UserRole created successfully");
    } catch (userRoleError) {
      console.error("Error creating UserRole:", userRoleError);
      console.error("UserRole error details:", {
        message: userRoleError.message,
        code: userRoleError.code,
        name: userRoleError.name,
        keyPattern: userRoleError.keyPattern,
        keyValue: userRoleError.keyValue,
      });
      throw userRoleError;
    }

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

    const { accessToken, refreshToken } = generateTokens(user._id);

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
        tokens: { accessToken, refreshToken },
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
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      // Log failed login attempt
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

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.last_login_at = Date.now();
    await user.save();
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

    res.status(200).json({
      success: true,
      message: "Đăng nhập thành công!",
      data: {
        user,
        tokens: { accessToken, refreshToken },
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

    const { facebookId, name, email, accessToken } = req.body;
    if (!facebookId || !accessToken) {
      return res.status(400).json({
        success: false,
        message: "Thiếu Facebook ID hoặc access token.",
      });
    }

    console.log("Đang xác thực ...");

    // Lấy thông tin user
    const fbResp = await fetch(
      `https://graph.facebook.com/me?access_token=${accessToken}&fields=id,name,email,picture.width(200).height(200)`
    );
    const fbData = await fbResp.json();

    if (!fbData.id || fbData.id !== facebookId) {
      // Log failed Facebook authentication
      await saveSystemLog({
        category: 'security',
        level: 'warning',
        action: 'FACEBOOK_LOGIN_FAILED',
        description: `Đăng nhập Facebook thất bại: Xác thực Facebook thất bại (facebookId: ${facebookId})`,
        ip_address: getClientIp(req),
        user_agent: getUserAgent(req),
        success: false,
        error_message: 'Facebook authentication failed',
      });
      return res
        .status(400)
        .json({ success: false, message: "Xác thực Facebook thất bại." });
    }

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
      const shop = await Shop.create({
        shop_name: fbData.name,
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

      // Tạo ShopUser với status "active" để được tính vào employee count
      const shopUser = await ShopUser.create({
        user_id: user._id,
        shop_id: shop._id,
        is_manager: true,
        status: "active", // Đảm bảo status là "active" để được tính vào employee count
      });
      console.log("✅ ShopUser created for Facebook user:", shopUser._id);

      // Tạo UserRole với role Shop Owner
      await UserRole.create({
        user_id: user._id,
        role_id: RoleEnum.SHOP_OWNER,
        shop_id: shop._id,
        shop_user_id: shopUser._id,
        is_current: true,
        source: "system", // Đánh dấu là được tạo tự động từ hệ thống
      });
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
            status: "active", // Đảm bảo status là "active" để được tính vào employee count
          });
          console.log("✅ ShopUser created for existing Facebook user:", shopUser._id);

          // Tạo UserRole nếu chưa có
          if (!existingUserRole) {
            await UserRole.create({
              user_id: user._id,
              role_id: RoleEnum.SHOP_OWNER,
              shop_id: shop._id,
              shop_user_id: shopUser._id,
              is_current: true,
              source: "system", // Đánh dấu là được tạo tự động từ hệ thống
            });
            console.log("✅ UserRole created for existing Facebook user");
          }
        } else if (!existingUserRole) {
          // Chỉ thiếu UserRole
          await UserRole.create({
            user_id: user._id,
            role_id: RoleEnum.SHOP_OWNER,
            shop_id: existingShopUser.shop_id,
            shop_user_id: existingShopUser._id,
            is_current: true,
            source: "system", // Đánh dấu là được tạo tự động từ hệ thống
          });
          console.log("✅ UserRole created for existing Facebook user");
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
    const { accessToken: at, refreshToken: rt } = generateTokens(user._id);

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

    // Gửi trả về FE cả user, tokens và pages
    return res.status(200).json({
      success: true,
      message: "Đăng nhập Facebook thành công.",
      data: { user, tokens: { accessToken: at, refreshToken: rt }, pages },
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

// Làm mới token
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.id);
    if (!user)
      return res
        .status(401)
        .json({ success: false, message: "Refresh token không hợp lệ." });

    const tokens = generateTokens(user._id);
    res.status(200).json({
      success: true,
      message: "Làm mới token thành công.",
      data: { tokens },
    });
  } catch {
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
    if (!user)
      return res.status(400).json({
        success: true,
        message: "Email không tồn tại trong hệ thống",
      });

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
      .json({ success: true, message: "Email đặt lại mật khẩu đã được gửi!" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// Đặt lại mật khẩu
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
    await user.save();

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

    // Ưu tiên 1: Lấy shop_id từ UserRole với is_current = true (shop đang active)
    const currentUserRole = await UserRole.findOne({
      user_id: user._id,
      is_current: true,
      shop_id: { $ne: null },
      revoked_at: null,
    }).lean();

    if (currentUserRole?.shop_id) {
      // Nếu có UserRole với is_current = true, lấy shop từ shop_id đó
      shopId = currentUserRole.shop_id;
      shop = await Shop.findOne({
        _id: shopId,
        deleted_at: null,
      }).lean();
    } else {
      // Fallback: Tìm shop mà user là owner (theo đề xuất)
      shop = await Shop.findOne({
        owner_id: user._id,
        deleted_at: null,
      }).lean();

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
      
      // ✅ Đảm bảo shop được populate với facebook_pages
      if (!shop) {
        shop = await Shop.findById(shopId).lean();
      }
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
    const userId = req.user._id; // Lấy user từ middleware xác thực JWT
    const { currentPassword, newPassword } = req.body;

    // Kiểm tra đầu vào
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.",
      });
    }

    // Lấy user có chứa trường password
    const user = await User.findById(userId).select("+password");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng." });
    }

    // Kiểm tra mật khẩu cũ
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu hiện tại không chính xác.",
      });
    }

    // Kiểm tra mật khẩu mới khác mật khẩu cũ
    if (await bcrypt.compare(newPassword, user.password)) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới không được trùng với mật khẩu hiện tại.",
      });
    }

    // Hash và lưu mật khẩu mới
    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

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
    // Không block logout flow nếu log lỗi
  }
  res.status(200).json({ success: true, message: "Đăng xuất thành công." });
};

// Link Facebook account to existing user (không tạo user mới)
export const linkFacebook = async (req, res) => {
  try {
    const currentUser = req.user;
    const { facebookId, accessToken } = req.body;

    if (!facebookId || !accessToken) {
      return res.status(400).json({
        success: false,
        message: "Thiếu Facebook ID hoặc access token.",
      });
    }

    // Xác thực Facebook token
    const fbResp = await axios.get(
      `https://graph.facebook.com/me?access_token=${accessToken}&fields=id,name,email,picture.width(200).height(200)`
    );
    const fbData = fbResp.data;

    if (!fbData.id || fbData.id !== facebookId) {
      return res.status(400).json({
        success: false,
        message: "Xác thực Facebook thất bại.",
      });
    }

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