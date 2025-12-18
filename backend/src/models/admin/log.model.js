// src/models/log.model.js
import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
  // Người thực hiện hành động
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true, // Tăng tốc query theo user
  },

  // Cửa hàng liên quan
  shop_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true,
    index: true, // Bắt buộc có shop_id + index để query nhanh
  },

  // Hành động (ví dụ: ADD_EMPLOYEE, ASSIGN_PAGES, CONNECT_FACEBOOK_PAGE...)
  action: {
    type: String,
    required: true,
    trim: true,
    index: true, // Tìm theo action nhanh
  },

  // Loại đối tượng bị tác động (User, Shop, FacebookPage...)
  target_type: {
    type: String,
    enum: ['User', 'Shop', 'FacebookPage', 'UserRole', 'ShopUser', 'Campaign'],
    default: 'User',
  },

  // ID của đối tượng bị tác động
  target_id: {
    type: String,
    required: false,
  },

  // Tên hiển thị của đối tượng (để frontend không cần join)
  target_name: {
    type: String,
    trim: true,
  },

  // Tên người thực hiện (cache để frontend hiển thị ngay, không cần populate)
  user_name: {
    type: String,
    trim: true,
  },
  
  // Tên cửa hàng (cache để hiển thị ngay)
  shop_name: {
    type: String,
    trim: true,
  },

  // MÔ TẢ CHI TIẾT – SIÊU QUAN TRỌNG CHO FRONTEND
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
  },

  // Request body (lưu tối đa 2KB để tránh DB phình to)
  request: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
    validate: {
      validator: (v) => JSON.stringify(v).length <= 2000,
      message: 'Request quá lớn (>2KB)',
    },
  },

  // Response (chỉ lưu những field cần thiết)
  response: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
    validate: {
      validator: (v) => JSON.stringify(v).length <= 3000,
      message: 'Response quá lớn (>3KB)',
    },
  },

  // Thành công hay thất bại
  success: {
    type: Boolean,
    default: true,
  },

  // Lỗi nếu có
  error_message: {
    type: String,
    maxlength: 500,
  },

  // Nguồn: manual (người dùng), system (tự động), scheduler (cron job)
  source: {
    type: String,
    enum: ['manual', 'system', 'scheduler'],
    default: 'manual',
  },

  // IP người dùng
  ip_address: {
    type: String,
    trim: true,
  },

  // User agent (browser, mobile...)
  user_agent: {
    type: String,
    maxlength: 300,
  },

  // Dữ liệu bổ sung (page list, old_role, new_role...)
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },

  // Thời gian tạo
  created_at: {
    type: Date,
    default: Date.now,
    index: true, // Index để sort nhanh theo thời gian
  },
}, {
  timestamps: false, // Không dùng createdAt/updateAt tự động
  collection: 'logs',
});

// === TỰ ĐỘNG TẠO COMPOUND INDEX SIÊU NHANH ===
logSchema.index({ shop_id: 1, created_at: -1 }); // Query log theo shop + mới nhất trước
logSchema.index({ user_id: 1, created_at: -1 });
logSchema.index({ action: 1, created_at: -1 });

// === TỰ ĐỘNG XÓA LOG CŨ SAU 90 NGÀY (TỐI ƯU DB) ===
logSchema.index({ created_at: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 ngày

// === VIRTUAL POPULATE (nếu cần hiển thị full user/shop) ===
logSchema.virtual('user', {
  ref: 'User',
  localField: 'user_id',
  foreignField: '_id',
  justOne: true,
});

logSchema.virtual('shop', {
  ref: 'Shop',
  localField: 'shop_id',
  foreignField: '_id',
  justOne: true,
});

// === TỰ ĐỘNG SET user_name, shop_name TRƯỚC KHI SAVE ===
logSchema.pre('save', async function(next) {
  try {
    if (this.isModified('user_id') || !this.user_name) {
      if (this.user_id) {
        const user = await mongoose.model('User').findById(this.user_id).lean();
        this.user_name = user?.full_name || user?.email || 'Hệ thống';
      }
    }
    if (this.isModified('shop_id') || !this.shop_name) {
      if (this.shop_id) {
        const shop = await mongoose.model('Shop').findById(this.shop_id).lean();
        this.shop_name = shop?.shop_name || 'Shop không xác định';
      }
    }
  } catch (err) {
    console.error('Lỗi pre-save log:', err);
  }
  next();
});

export default mongoose.model('Log', logSchema);