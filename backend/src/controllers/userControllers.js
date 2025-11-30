import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendStaffCredentialsEmail } from "../services/emailService.js";
import UserRole from "../models/userRole.model.js";
import Shop from "../models/shops/shop.model.js";
import Role from "../models/role.model.js";
import { saveSystemLog, getClientIp, getUserAgent } from "../utils/systemLog.js";

// 📋 Lấy danh sách user
export const getUsers = async (req, res) => {
  try {
    const users = await User.find({ deleted_at: null }).select("-password -facebookAccessToken -facebookRefreshToken");
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error("❌ Get users error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// 👥 Lấy danh sách customers (users không có internal_role hoặc internal_role là null)
export const getCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status, startDate, endDate } = req.query;

    const query = {
      deleted_at: null,
      $or: [
        { internal_role: { $exists: false } },
        { internal_role: null },
        { internal_role: { $nin: ["System Admin", "CS Staff", "Accountant"] } }
      ]
    };

    // Filter by status
    if (status && status !== "All") {
      query.status = status;
    }

    // Search by name, email, phone
    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      query.$and = [
        {
          $or: [
            { full_name: searchRegex },
            { email: searchRegex },
            { phone: searchRegex }
          ]
        }
      ];
    }

    // Filter by date range
    if (startDate && endDate) {
      // Parse dd/mm/yyyy
      const parseDate = (dateStr) => {
        const [d, m, y] = dateStr.split("/").map(Number);
        return new Date(y, m - 1, d);
      };

      const start = parseDate(startDate);
      const end = parseDate(endDate);
      end.setHours(23, 59, 59, 999);

      query.created_at = {
        $gte: start,
        $lte: end
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const customers = await User.find(query)
      .select("-password -facebookAccessToken -facebookRefreshToken")
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    // Calculate stats
    const stats = await User.aggregate([
      { $match: { role: "customer", deleted_at: null } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const formattedStats = {
      total: await User.countDocuments({ role: "customer", deleted_at: null }),
      active: stats.find(s => s._id === "active")?.count || 0,
      inactive: stats.find(s => s._id === "inactive")?.count || 0,
      banned: stats.find(s => s._id === "banned")?.count || 0
    };

    res.status(200).json({
      success: true,
      total,
      stats: formattedStats,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: customers,
    });
  } catch (error) {
    console.error("❌ Get customers error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// 👥 Lấy danh sách internal staff (users có internal_role)
export const getInternalStaff = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status, role, startDate, endDate } = req.query;

    const filter = {
      deleted_at: null,
      internal_role: { $in: ["System Admin", "CS Staff", "Accountant"] }, // Assuming a 'role' field is added to User model
    };

    // Filter by status
    if (status && status !== "All") {
      filter.status = status;
    }

    // Filter by role (internal_role)
    if (role && role !== "All") {
      filter.internal_role = role;
    }

    // Search by name, email, phone
    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      filter.$or = [
        { full_name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    // Filter by date range
    if (startDate && endDate) {
      const parseDate = (dateStr) => {
        const [d, m, y] = dateStr.split("/").map(Number);
        return new Date(y, m - 1, d);
      };

      const start = parseDate(startDate);
      const end = parseDate(endDate);
      end.setHours(23, 59, 59, 999);

      filter.created_at = {
        $gte: start,
        $lte: end
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const staff = await User.find(filter)
      .select("-password -facebookAccessToken -facebookRefreshToken")
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    // Calculate stats
    const stats = await User.aggregate([
      { $match: { role: "internal", deleted_at: null } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const formattedStats = {
      total: await User.countDocuments({ role: "internal", deleted_at: null }),
      active: stats.find(s => s._id === "active")?.count || 0,
      inactive: stats.find(s => s._id === "inactive")?.count || 0,
      banned: stats.find(s => s._id === "banned")?.count || 0
    };

    res.status(200).json({
      success: true,
      total,
      stats: formattedStats,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: staff,
    });
  } catch (error) {
    console.error("❌ Get internal staff error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

/**
 * Lấy danh sách các giá trị `internal_role` có trong collection users
 * Trả về mảng các string (ví dụ: ["System Admin", "CS Staff", "Accountant"])
 */
export const getInternalRoles = async (req, res) => {
  try {
    // Lấy distinct internal_role, loại bỏ null/undefined
    const roles = await User.distinct('internal_role', { internal_role: { $ne: null } });
    // Optionally filter out empty strings and sort
    const cleaned = roles.filter(r => r && typeof r === 'string').sort();
    res.status(200).json({ success: true, data: cleaned });
  } catch (error) {
    console.error('❌ Get internal roles error:', error);
    res.status(500).json({ success: false, message: 'Không thể lấy danh sách internal roles.' });
  }
};

// 📄 Lấy thông tin user theo ID
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy user." });
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error("❌ Get user error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// Lấy danh sách shop và role của user
export const getUserShops = async (req, res) => {
  try {
    const { id } = req.params;

    // Kiểm tra user có tồn tại không
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy user." });
    }

    // Lấy tất cả UserRole của user (chỉ lấy những role chưa bị revoke)
    const userRoles = await UserRole.find({
      user_id: id,
      revoked_at: null,
      shop_id: { $ne: null }, // Chỉ lấy role có shop_id (bỏ qua global roles)
    })
      .populate("shop_id", "shop_name status")
      .populate("role_id", "role_name")
      .lean();

    // Format data: shop và role tương ứng
    const shopsWithRoles = userRoles.map((ur) => ({
      shop: ur.shop_id?.shop_name || "N/A",
      role: ur.role_id?.role_name || "N/A",
      shop_id: ur.shop_id?._id || null,
      role_id: ur.role_id?._id || null,
      is_current: ur.is_current || false,
    }));

    // Nếu user là owner của shop nhưng chưa có UserRole, thêm vào
    const shopsOwned = await Shop.find({
      owner_id: id,
      deleted_at: null,
    }).lean();

    for (const shop of shopsOwned) {
      // Kiểm tra xem shop này đã có trong danh sách chưa
      const exists = shopsWithRoles.some(
        (swr) => swr.shop_id && swr.shop_id.toString() === shop._id.toString()
      );

      if (!exists) {
        // Tìm role "Shop Owner"
        const shopOwnerRole = await Role.findOne({ role_name: "Shop Owner" }).lean();
        shopsWithRoles.push({
          shop: shop.shop_name,
          role: shopOwnerRole?.role_name || "Shop Owner",
          shop_id: shop._id,
          role_id: shopOwnerRole?._id || null,
          is_current: false,
        });
      }
    }

    res.status(200).json({
      success: true,
      data: shopsWithRoles,
    });
  } catch (error) {
    console.error("❌ Get user shops error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// 🧾 Tạo user (admin thêm mới)
export const createUser = async (req, res) => {
  try {
    const { full_name, email, password, phone, status } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: "Email đã tồn tại." });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ full_name, email, password: hashed, phone, status, provider: "local" });

    // Log user creation (admin action)
    await saveSystemLog({
      category: 'admin',
      level: 'info',
      action: 'USER_CREATED',
      user_id: req.user._id,
      user_name: req.user.full_name,
      internal_role: req.user.internal_role,
      target_type: 'User',
      target_id: user._id.toString(),
      target_name: user.full_name,
      ip_address: getClientIp(req),
      user_agent: getUserAgent(req),
      success: true,
    });

    res.status(201).json({ success: true, message: "Tạo user thành công!", data: user });
  } catch (error) {
    console.error("❌ Create user error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// 🔄 Cập nhật user
export const updateUser = async (req, res) => {
  try {
    // Kiểm tra quyền: System Admin hoặc user có quyền update
    const isSystemAdmin = req.user.internal_role === "System Admin";

    if (!isSystemAdmin) {
      // Nếu không phải System Admin, kiểm tra quyền qua UserRole
      const shopId = req.headers['x-shop-id'] || req.query.shop_id || null;
      const hasPermission = await UserRole.hasPermission(req.user._id, shopId, "user", "update");

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền update trên module user.",
        });
      }
    }

    const { id } = req.params;
    const { full_name, email, phone, password, status } = req.body;

    // Get old user data to check status change
    const oldUser = await User.findById(id);
    if (!oldUser) return res.status(404).json({ success: false, message: "Không tìm thấy user." });

    const data = { full_name, email, phone, status };
    if (password) data.password = await bcrypt.hash(password, 10);
    const user = await User.findByIdAndUpdate(id, data, { new: true }).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy user." });

    // Log user update (admin action)
    const action = status && status !== oldUser.status ? 'USER_STATUS_UPDATED' : 'USER_UPDATED';
    await saveSystemLog({
      category: 'admin',
      level: 'info',
      action,
      user_id: req.user._id,
      user_name: req.user.full_name,
      internal_role: req.user.internal_role,
      target_type: 'User',
      target_id: user._id.toString(),
      target_name: user.full_name,
      ip_address: getClientIp(req),
      user_agent: getUserAgent(req),
      success: true,
      meta: {
        old_status: oldUser.status,
        new_status: status || oldUser.status,
      },
    });

    res.status(200).json({ success: true, message: "Cập nhật thành công!", data: user });
  } catch (error) {
    console.error("❌ Update user error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// 🗑️ Xóa mềm user
export const deleteUser = async (req, res) => {
  try {
    const oldUser = await User.findById(req.params.id);
    if (!oldUser) return res.status(404).json({ success: false, message: "Không tìm thấy user." });

    const user = await User.findByIdAndUpdate(req.params.id, { deleted_at: new Date() }, { new: true });

    // Log user deletion (admin action)
    await saveSystemLog({
      category: 'admin',
      level: 'info',
      action: 'USER_DELETED',
      user_id: req.user._id,
      user_name: req.user.full_name,
      internal_role: req.user.internal_role,
      target_type: 'User',
      target_id: oldUser._id.toString(),
      target_name: oldUser.full_name,
      ip_address: getClientIp(req),
      user_agent: getUserAgent(req),
      success: true,
    });

    res.status(200).json({ success: true, message: "User đã được xóa (soft delete)." });
  } catch (error) {
    console.error("❌ Delete user error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// 👥 Tạo nhân viên nội bộ (chỉ System Admin)
export const createInternalStaff = async (req, res) => {
  try {
    // Kiểm tra quyền System Admin
    if (req.user.internal_role !== "System Admin") {
      return res.status(403).json({
        success: false,
        message: "Chỉ System Admin mới có quyền tạo nhân viên nội bộ.",
      });
    }

    const { email, role } = req.body;

    // Validate input
    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email là bắt buộc.",
      });
    }

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Role là bắt buộc.",
      });
    }

    // Validate internal_role
    const validRoles = ["System Admin", "CS Staff", "Accountant"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Role không hợp lệ. Chỉ chấp nhận: ${validRoles.join(", ")}`,
      });
    }

    // Kiểm tra email đã tồn tại
    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Email này đã được sử dụng.",
      });
    }

    // Tạo full_name ngẫu nhiên: "Staff_" + 8 ký tự ngẫu nhiên
    const randomSuffix = crypto.randomBytes(4).toString("hex");
    const full_name = `Staff_${randomSuffix}`;

    // Tạo password ngẫu nhiên an toàn (12 ký tự)
    // Bao gồm: chữ hoa, chữ thường, số, ký tự đặc biệt
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const allChars = uppercase + lowercase + numbers;

    // Đảm bảo có ít nhất 1 ký tự từ mỗi loại
    let password =
      uppercase[Math.floor(Math.random() * uppercase.length)] +
      lowercase[Math.floor(Math.random() * lowercase.length)] +
      numbers[Math.floor(Math.random() * numbers.length)];

    // Thêm các ký tự ngẫu nhiên để đủ 12 ký tự
    for (let i = password.length; i < 12; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Xáo trộn password
    password = password
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo user
    const user = await User.create({
      email: email.trim().toLowerCase(),
      internal_role: role,
      full_name,
      password: hashedPassword,
      status: "active",
      emailVerified: true,
      provider: "local",
    });

    // Gửi email thông tin đăng nhập
    try {
      await sendStaffCredentialsEmail(email.trim().toLowerCase(), password);
    } catch (emailError) {
      console.error("❌ Error sending staff credentials email:", emailError);
      // Vẫn trả về success nhưng log lỗi email
      // Có thể rollback user nếu cần, nhưng theo yêu cầu thì vẫn tạo user
    }

    // Log internal staff creation (admin action)
    await saveSystemLog({
      category: 'admin',
      level: 'info',
      action: 'USER_CREATED',
      description: `System Admin đã tạo nhân viên nội bộ mới: ${user.full_name} (${user.internal_role})`,
      user_id: req.user._id,
      user_name: req.user.full_name,
      internal_role: req.user.internal_role,
      target_type: 'User',
      target_id: user._id.toString(),
      target_name: user.full_name,
      ip_address: getClientIp(req),
      user_agent: getUserAgent(req),
      success: true,
      meta: {
        internal_role: user.internal_role,
        email: user.email,
      },
    });

    // Trả về user (không bao gồm password)
    const userResponse = user.toJSON();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: "Tạo nhân viên nội bộ thành công!",
      data: userResponse,
    });
  } catch (error) {
    console.error("❌ Create internal staff error:", error);

    // Xử lý lỗi duplicate key (email)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email này đã được sử dụng.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tạo nhân viên nội bộ.",
    });
  }
};