import Role from "../models/role.model.js";
import mongoose from "mongoose";

/**
 * 📋 Lấy danh sách tất cả role
 */
export const getRoles = async (req, res) => {
  try {
    const roles = await Role.find({ deleted_at: null }).sort({ priority: 1 });
    res.status(200).json({
      success: true,
      count: roles.length,
      data: roles,
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách role:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách role.",
    });
  }
};

/**
 * 🔍 Lấy role theo ID
 */
export const getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role || role.deleted_at) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy role.",
      });
    }

    res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy role:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống.",
    });
  }
};

/**
 * 🧱 Tạo mới role
 */
export const createRole = async (req, res) => {
  try {
    const { role_name, description, permissions, scope, priority, type } = req.body;

    if (!role_name)
      return res.status(400).json({ success: false, message: "Tên role là bắt buộc." });

    // Kiểm tra trùng tên
    const existing = await Role.findOne({ role_name });
    if (existing) {
      return res.status(400).json({ success: false, message: "Role này đã tồn tại." });
    }

    const newRole = await Role.create({
      role_name,
      description,
      permissions: permissions || [],
      scope: scope || "shop",
      priority: priority || 10,
      type: type || "custom",
      created_by: req.user?._id || null,
    });

    res.status(201).json({
      success: true,
      message: "Tạo vai trò thành công!",
      data: newRole,
    });
  } catch (error) {
    console.error("❌ Lỗi khi tạo role:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống.",
    });
  }
};

/**
 * ✏️ Cập nhật role (bao gồm chỉnh sửa permissions)
 */
export const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role_name, description, permissions, scope, priority, type } = req.body;

    const updateData = {
      role_name,
      description,
      permissions,
      scope,
      priority,
      type,
      updated_by: req.user?._id || null,
    };

    const role = await Role.findByIdAndUpdate(id, updateData, { new: true });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy role cần cập nhật.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật role thành công!",
      data: role,
    });
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật role:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống.",
    });
  }
};

/**
 * 🗑️ Xóa role (soft delete)
 */
export const deleteRole = async (req, res) => {
  try {
    const role = await Role.findByIdAndUpdate(req.params.id, { deleted_at: new Date() }, { new: true });
    if (!role) {
      return res.status(404).json({ success: false, message: "Không tìm thấy role." });
    }

    res.status(200).json({
      success: true,
      message: "Role đã được xóa thành công.",
    });
  } catch (error) {
    console.error("❌ Lỗi khi xóa role:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống.",
    });
  }
};

/**
 * 🧩 Thêm hoặc cập nhật permission cho role
 * Ví dụ body:
 * {
 *   "permissions": [
 *     { "module": "ads", "actions": ["create", "view"] },
 *     { "module": "shop", "actions": ["update"] }
 *   ]
 * }
 */
export const updateRolePermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        message: "Danh sách permissions không hợp lệ.",
      });
    }

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ success: false, message: "Không tìm thấy role." });
    }

    role.permissions = permissions;
    role.updated_by = req.user?._id || null;
    await role.save();

    res.status(200).json({
      success: true,
      message: "Cập nhật quyền cho role thành công.",
      data: role,
    });
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật quyền role:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống.",
    });
  }
};

/**
 * ⚙️ Kiểm tra role có quyền cụ thể không (debug endpoint)
 * GET /roles/:id/check?module=shop&action=create
 */
export const checkRolePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const { module, action } = req.query;

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ success: false, message: "Không tìm thấy role." });
    }

    const has = Role.hasPermission(role, module, action);
    res.status(200).json({
      success: true,
      role: role.role_name,
      module,
      action,
      permitted: has,
    });
  } catch (error) {
    console.error("❌ checkRolePermission error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống.",
    });
  }
};
