import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import fetch from "node-fetch";
import axios from "axios";
import { generateTokens, verifyRefreshToken } from "../utils/jwt.js";
import Shop from "../models/shops/shop.model.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../services/emailService.js";
import jwt from "jsonwebtoken";

// Hàm xác thực CAPTCHA bằng axios
async function verifyCaptcha(token) {
  try {
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) {
      throw new Error('RECAPTCHA_SECRET_KEY not configured');
    }
    
    const response = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`
    );
    
    return {
      success: response.data.success,
      errorCodes: response.data['error-codes'] || [],
      hostname: response.data.hostname
    };
  } catch (error) {
    console.error('CAPTCHA verification request failed:', error.message);
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
        console.log('CAPTCHA verification failed:', captchaResult.errorCodes);
        return res.status(400).json({
          success: false,
          message: "Xác thực CAPTCHA thất bại. Vui lòng thử lại.",
        });
      }
      
      console.log('CAPTCHA verification successful for hostname:', captchaResult.hostname);
    } catch (captchaError) {
      console.error('CAPTCHA verification error:', captchaError.message);
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
    await Shop.create({
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

    // Tạo token xác minh email
    const token = crypto.randomBytes(32).toString("hex");
    user.emailVerificationToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
    user.emailVerificationExpires = Date.now() + 3600000; // 1h
    await user.save();

    // Gửi email xác nhận
    await sendVerificationEmail(email, full_name, token);

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
    if (!user)
      return res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không chính xác.",
      });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không chính xác.",
      });

    if (user.status !== "active")
      return res
        .status(403)
        .json({ success: false, message: "Tài khoản chưa được kích hoạt." });

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.password = undefined;

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
      await Shop.create({
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
    } else {
      user.avatar = fbData.picture?.data?.url || user.avatar;
      user.facebookAccessToken = longLivedToken;
      await user.save();
      console.log("Đăng nhập thành công  ");
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

    // Gửi trả về FE cả user, tokens và pages
    return res.status(200).json({
      success: true,
      message: "Đăng nhập Facebook thành công.",
      data: { user, tokens: { accessToken: at, refreshToken: rt }, pages },
    });
  } catch (error) {
    console.error("Facebook login error:", error);
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
      return res.status(200).json({
        success: true,
        message: "Nếu email tồn tại, hướng dẫn đã được gửi.",
      });

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.passwordResetExpires = Date.now() + 3600000;
    await user.save({ validateBeforeSave: false });

    await sendPasswordResetEmail(email, user.full_name, resetToken);
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
    const shop = await Shop.findOne({
      owner_id: user._id,
      deleted_at: null,
    }).lean();

    return res.status(200).json({
      success: true,
      data: {
        user,
        shop,
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
      return res
        .status(400)
        .json({
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
    await sendVerificationEmail(user.email, user.full_name, token);

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
export const logout = async (_req, res) => {
  res.status(200).json({ success: true, message: "Đăng xuất thành công." });
};