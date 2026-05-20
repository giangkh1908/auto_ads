// backend/src/models/systemLogs.model.js
import mongoose from 'mongoose';

const systemLogSchema = new mongoose.Schema({
  // Người thực hiện hành động (optional - có thể là system action)
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true,
  },

  // Tên người thực hiện (cache để hiển thị ngay)
  user_name: {
    type: String,
    trim: true,
    default: 'Hệ thống',
  },

  // Vai trò nội bộ (System Admin, CS Staff, Accountant)
  internal_role: {
    type: String,
    enum: ['System Admin', 'CS Staff', 'Accountant', 'System', null],
    default: null,
    index: true,
  },

  // Danh mục hành động
  category: {
    type: String,
    enum: [
      'auth',           // Authentication (login, logout, register, password reset)
      'admin',          // Admin actions (payment approval, user management)
      'system',         // System events (errors, warnings, config changes)
      'automation',     // Automation rule executions
      'scheduler',      // Scheduled tasks
      'security',       // Security events (failed login attempts, suspicious activity)
      'api',            // API calls/errors
      'other',          // Other system events
    ],
    required: true,
    index: true,
  },

  // Mức độ log
  level: {
    type: String,
    enum: ['info', 'warning', 'error', 'success'],
    default: 'info',
    index: true,
  },

  // Hành động/Event type (ví dụ: USER_LOGIN, PAYMENT_APPROVED, SYSTEM_ERROR...)
  action: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },

  // Mô tả chi tiết sự kiện
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
  },

  // Loại đối tượng bị tác động (User, PaymentTransaction, AutomationRule...)
  target_type: {
    type: String,
    enum: [
      'User', 
      'PaymentTransaction', 
      'AutomationRule', 
      'System', 
      'API', 
      'Shop',
      null
    ],
    default: null,
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

  // Thành công hay thất bại
  success: {
    type: Boolean,
    default: true,
    index: true,
  },

  // Thông báo lỗi nếu có
  error_message: {
    type: String,
    maxlength: 500,
  },

  // Stack trace (cho errors)
  error_stack: {
    type: String,
    maxlength: 2000,
  },

  // IP address
  ip_address: {
    type: String,
    trim: true,
    index: true,
  },

  // User agent
  user_agent: {
    type: String,
    maxlength: 300,
  },

  // Request data (lưu tối đa 2KB)
  request_data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
    validate: {
      validator: (v) => JSON.stringify(v).length <= 2000,
      message: 'Request data quá lớn (>2KB)',
    },
  },

  // Response data (lưu tối đa 3KB)
  response_data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
    validate: {
      validator: (v) => JSON.stringify(v).length <= 3000,
      message: 'Response data quá lớn (>3KB)',
    },
  },

  // Metadata bổ sung (flexible cho các thông tin khác)
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },

  // Thời gian tạo
  created_at: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: false, // Sử dụng created_at thủ công
  collection: 'systemlogs',
});

// === COMPOUND INDEXES CHO QUERY NHANH ===
systemLogSchema.index({ category: 1, created_at: -1 }); // Query theo category + mới nhất trước
systemLogSchema.index({ level: 1, created_at: -1 }); // Query theo level + mới nhất trước
systemLogSchema.index({ user_id: 1, created_at: -1 }); // Query theo user + mới nhất trước
systemLogSchema.index({ internal_role: 1, created_at: -1 }); // Query theo role + mới nhất trước
systemLogSchema.index({ action: 1, created_at: -1 }); // Query theo action + mới nhất trước
systemLogSchema.index({ success: 1, created_at: -1 }); // Query errors/warnings

// === TỰ ĐỘNG XÓA LOG CŨ SAU 180 NGÀY (6 THÁNG) ===
systemLogSchema.index({ created_at: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

// === VIRTUAL POPULATE (nếu cần hiển thị full user) ===
systemLogSchema.virtual('user', {
  ref: 'User',
  localField: 'user_id',
  foreignField: '_id',
  justOne: true,
});

// === TỰ ĐỘNG SET user_name, internal_role TRƯỚC KHI SAVE ===
systemLogSchema.pre('save', async function(next) {
  try {
    // Nếu có user_id và chưa có user_name hoặc user_id thay đổi
    if (this.user_id && (this.isModified('user_id') || !this.user_name || this.user_name === 'Hệ thống')) {
      const user = await mongoose.model('User').findById(this.user_id).lean();
      if (user) {
        this.user_name = user.full_name || user.email || 'Người dùng';
        // Set internal_role nếu có
        if (user.internal_role && !this.internal_role) {
          this.internal_role = user.internal_role;
        }
      }
    }

    // Nếu không có user_id thì đảm bảo là system action
    if (!this.user_id && !this.internal_role) {
      this.internal_role = 'System';
      this.user_name = 'Hệ thống';
    }
  } catch (err) {
    console.error('Lỗi pre-save systemLog:', err);
    // Không throw error để không block việc save log
  }
  next();
});

// === STATIC METHODS ===

// Lấy logs theo filters
systemLogSchema.statics.findByFilters = async function(filters = {}) {
  const {
    user_id,
    internal_role,
    category,
    level,
    action,
    success,
    startDate,
    endDate,
    search,
    limit = 100,
    skip = 0,
  } = filters;

  const query = {};

  if (user_id) query.user_id = user_id;
  if (internal_role && internal_role !== 'All') query.internal_role = internal_role;
  if (category) query.category = category;
  if (level) query.level = level;
  if (action) query.action = action;
  if (success !== undefined) query.success = success;

  // Date range
  if (startDate || endDate) {
    query.created_at = {};
    if (startDate) query.created_at.$gte = new Date(startDate);
    if (endDate) query.created_at.$lte = new Date(endDate);
  }

  // Search trong description, user_name, target_name
  if (search) {
    query.$or = [
      { description: { $regex: search, $options: 'i' } },
      { user_name: { $regex: search, $options: 'i' } },
      { target_name: { $regex: search, $options: 'i' } },
    ];
  }

  const [data, total] = await Promise.all([
    this.find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean(),
    this.countDocuments(query),
  ]);

  return { data, total };
};

// Lưu error log
systemLogSchema.statics.logError = async function(error, context = {}) {
  try {
    return await this.create({
      category: context.category || 'system',
      level: 'error',
      action: context.action || 'SYSTEM_ERROR',
      description: error.message || 'Lỗi hệ thống không xác định',
      error_message: error.message,
      error_stack: error.stack?.substring(0, 2000),
      user_id: context.user_id,
      user_name: context.user_name,
      internal_role: context.internal_role,
      ip_address: context.ip_address,
      user_agent: context.user_agent,
      request_data: context.request_data,
      success: false,
      meta: context.meta || {},
    });
  } catch (err) {
    console.error('Lỗi khi lưu error log:', err);
    return null;
  }
};

// Lưu info log
systemLogSchema.statics.logInfo = async function(data) {
  try {
    return await this.create({
      category: data.category || 'system',
      level: data.level || 'info',
      action: data.action || 'SYSTEM_EVENT',
      description: data.description || 'Sự kiện hệ thống',
      user_id: data.user_id,
      user_name: data.user_name,
      internal_role: data.internal_role,
      ip_address: data.ip_address,
      user_agent: data.user_agent,
      target_type: data.target_type,
      target_id: data.target_id,
      target_name: data.target_name,
      request_data: data.request_data,
      response_data: data.response_data,
      success: data.success !== undefined ? data.success : true,
      error_message: data.error_message,
      meta: data.meta || {},
    });
  } catch (err) {
    console.error('Lỗi khi lưu info log:', err);
    return null;
  }
};

const SystemLog = mongoose.model('SystemLog', systemLogSchema);

export default SystemLog;
