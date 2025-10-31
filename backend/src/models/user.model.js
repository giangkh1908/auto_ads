import mongoose from "mongoose";
import validator from "validator";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    // 🧩 Thông tin cơ bản
    avatar: {
      type: String,
      default: null // hoặc có thể để rỗng ''
    },

    full_name: {
      type: String,
      required: [true, "Họ và tên là bắt buộc"],
      trim: true,
      maxlength: [100, "Tên không được quá 100 ký tự"],
    },

    email: {
      type: String,
      sparse: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) => !v || validator.isEmail(v),
        message: "Email không hợp lệ",
      },
    },

    phone: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || validator.isMobilePhone(v, "vi-VN"),
        message: "Số điện thoại không hợp lệ",
      },
    },

    password: {
      type: String,
      minlength: [6, "Mật khẩu phải có ít nhất 6 ký tự"],
      select: false,
    },

    username: {
      type: String,
      immutable: true,
      default: () => crypto.randomBytes(4).toString("hex"),
    },

    provider: {
      type: String,
      enum: ["local", "facebook"],
      default: "local",
    },

    // 🌍 Localization
    country: { type: String, default: "Viet Nam" },
    language: { type: String, default: "vi" },
    timezone: { type: String, default: "Asia/Ho_Chi_Minh" },

    // 📊 Trạng thái tài khoản
    status: {
      type: String,
      enum: ["pending", "active", "inactive", "banned"],
      default: "pending",
    },

    // 🧾 Hồ sơ công khai
    profile: {
      avatar: { type: String, trim: true },
      address: { type: String, trim: true },
      bio: { type: String, trim: true },
    },

    // 🔗 Facebook Integration
    facebookId: { type: String, sparse: true },
    facebookAccessToken: { type: String, select: false },
    facebookRefreshToken: { type: String, select: false },
    facebookTokenExpires: { type: Date },
    facebookPermissions: [String],
    facebookPageInfo: [
      {
        page_id: String,
        page_name: String,
        page_access_token: String,
      },
    ],

    // 💼 Meta Business Info
    business_info: {
      business_id: String,
      name: String,
      role: String,
    },

    // 🔑 Email verification
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },

    // 🔄 Reset password
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    // 🧠 Audit
    last_login_at: { type: Date },
    last_login_ip: { type: String },

    // 🗑️ Soft delete
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// 📈 Index (chỉ định nghĩa 1 lần để tránh trùng)
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ facebookId: 1 }, { unique: true, sparse: true });
userSchema.index({ status: 1 });

// 🔐 Ẩn dữ liệu nhạy cảm khi toJSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.facebookAccessToken;
  delete obj.facebookRefreshToken;
  delete obj.emailVerificationToken;
  delete obj.passwordResetToken;
  return obj;
};

// Virtual: populate user roles
userSchema.virtual("user_roles", {
  ref: "UserRole",
  localField: "_id",
  foreignField: "user_id",
});

const User = mongoose.model("User", userSchema);
export default User;
