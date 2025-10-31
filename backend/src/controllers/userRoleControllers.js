import UserRole from "../models/userRole.model.js";
import Role from "../models/role.model.js";
import User from "../models/user.model.js";
import Shop from "../models/shop.model.js";

/**
 * 🎯 Gán role cho user
 */
export const assignRole = async (req, res) => {
  try {
    const { userId, roleName, shopId, assignedBy, source } = req.body;

    // 🔹 Kiểm tra user tồn tại
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng." });
    }

    // 🔹 Tìm role theo tên
    const role = await Role.findOne({ role_name: roleName });
    if (!role) {
      return res.status(404).json({ success: false, message: "Không tìm thấy role." });
    }

    // 🔹 Nếu có shopId thì kiểm tra shop tồn tại
    if (shopId) {
      const shop = await Shop.findById(shopId);
      if (!shop) {
        return res.status(404).json({ success: false, message: "Shop không tồn tại." });
      }
    }

    // 🔹 Kiểm tra trùng
    const existing = await UserRole.findOne({
      user_id: userId,
      role_id: role._id,
      shop_id: shopId || null,
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Người dùng đã được gán role này rồi.",
      });
    }

    // 🔹 Tạo userRole mới
    const userRole = await UserRole.create({
      user_id: userId,
      role_id: role._id,
      shop_id: shopId || null,
      assigned_by: assignedBy || req.user?._id || null,
      source: source || "manual",
    });

    const populated = await userRole
      .populate("user_id", "full_name email")
      .populate("role_id", "role_name description")
      .populate("shop_id", "shop_name");

    return res.status(201).json({
      success: true,
      message: "Gán role cho người dùng thành công!",
      data: populated,
    });
  } catch (error) {
    console.error("❌ assignRole error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống, vui lòng thử lại sau.",
    });
  }
};

/**
 * 📋 Lấy tất cả UserRole (phân quyền toàn hệ thống)
 */
export const getUserRoles = async (req, res) => {
  try {
    const data = await UserRole.find()
      .populate("user_id", "full_name email")
      .populate("role_id", "role_name description")
      .populate("shop_id", "shop_name");

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("❌ getUserRoles error:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách UserRole.",
    });
  }
};

/**
 * 🔍 Lấy UserRole theo ID
 */
export const getUserRoleById = async (req, res) => {
  try {
    const userRole = await UserRole.findById(req.params.id)
      .populate("user_id", "full_name email")
      .populate("role_id", "role_name description")
      .populate("shop_id", "shop_name");

    if (!userRole) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy UserRole.",
      });
    }

    res.status(200).json({ success: true, data: userRole });
  } catch (error) {
    console.error("❌ getUserRoleById error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống.",
    });
  }
};

/**
 * 👤 Lấy danh sách role của 1 user
 */
export const getRolesByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const roles = await UserRole.find({ user_id: userId })
      .populate("role_id", "role_name description permissions")
      .populate("shop_id", "shop_name");

    if (!roles.length) {
      return res.status(404).json({ success: false, message: "Người dùng chưa được gán role nào." });
    }

    res.status(200).json({ success: true, data: roles });
  } catch (error) {
    console.error("❌ getRolesByUser error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

/**
 * ✏️ Cập nhật UserRole (đổi role hoặc shop)
 */
export const updateUserRole = async (req, res) => {
  try {
    const { roleName, shopId, revoked_at } = req.body;
    const updateData = {};

    if (roleName) {
      const role = await Role.findOne({ role_name: roleName });
      if (!role) return res.status(404).json({ success: false, message: "Không tìm thấy role mới." });
      updateData.role_id = role._id;
    }
    if (shopId) updateData.shop_id = shopId;
    if (revoked_at) updateData.revoked_at = revoked_at;

    const userRole = await UserRole.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate("user_id", "full_name email")
      .populate("role_id", "role_name description")
      .populate("shop_id", "shop_name");

    if (!userRole) {
      return res.status(404).json({ success: false, message: "Không tìm thấy UserRole." });
    }

    res.status(200).json({ success: true, message: "Cập nhật UserRole thành công!", data: userRole });
  } catch (error) {
    console.error("❌ updateUserRole error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

/**
 * 🗑️ Xóa UserRole
 */
export const deleteUserRole = async (req, res) => {
  try {
    const userRole = await UserRole.findByIdAndDelete(req.params.id);
    if (!userRole) {
      return res.status(404).json({ success: false, message: "Không tìm thấy UserRole." });
    }

    res.status(200).json({ success: true, message: "Đã xóa UserRole thành công." });
  } catch (error) {
    console.error("❌ deleteUserRole error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};
