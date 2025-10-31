import User from "../models/user.model.js";
import bcrypt from "bcryptjs";

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

// 🧾 Tạo user (admin thêm mới)
export const createUser = async (req, res) => {
  try {
    const { full_name, email, password, phone, status } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: "Email đã tồn tại." });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ full_name, email, password: hashed, phone, status, provider: "local" });
    res.status(201).json({ success: true, message: "Tạo user thành công!", data: user });
  } catch (error) {
    console.error("❌ Create user error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// 🔄 Cập nhật user
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, phone, password, status } = req.body;
    const data = { full_name, email, phone, status };
    if (password) data.password = await bcrypt.hash(password, 10);
    const user = await User.findByIdAndUpdate(id, data, { new: true }).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy user." });
    res.status(200).json({ success: true, message: "Cập nhật thành công!", data: user });
  } catch (error) {
    console.error("❌ Update user error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// 🗑️ Xóa mềm user
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { deleted_at: new Date() }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy user." });
    res.status(200).json({ success: true, message: "User đã được xóa (soft delete)." });
  } catch (error) {
    console.error("❌ Delete user error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};
