import Package from "../../models/package/package.model.js";
import mongoose from "mongoose";

export const getPackages = async (req, res) => {
  try {
    const { planType } = req.query; // ?planType=3months
    const filter = { status: "active", deleted_at: null };
    if (planType) filter.planType = planType;

    const packages = await Package.find(filter).sort({ price: 1 });

    res.status(200).json({
      success: true,
      count: packages.length,
      data: packages,
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách gói:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Create new package (for admin)
export const createPackage = async (req, res) => {
  try {
    const newPackage = await Package.create(req.body);
    res.status(201).json({
      success: true,
      data: newPackage,
    });
  } catch (error) {
    console.error("Lỗi khi tạo gói:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Update package
export const updatePackage = async (req, res) => {
  try {
    const updated = await Package.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete package (soft delete)
export const deletePackage = async (req, res) => {
  try {
    const deleted = await Package.findByIdAndUpdate(req.params.id, {
      deleted_at: new Date(),
      status: "inactive",
    });
    res.status(200).json({ success: true, message: "Đã xóa gói" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};