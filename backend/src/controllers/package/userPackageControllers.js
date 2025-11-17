import UserPackage from "../../models/userPackage.model.js";
import PaymentTransaction from "../../models/paymentTransaction.model.js";
import Package from "../../models/package.model.js";
import { getUserEntitlements } from "../../services/entitlementService.js";

export const createUserPackage = async (req, res) => {
    try {
        const data = req.body;

        const userPackage = await UserPackage.create({
            ...data,
            user_id: req.user?._id,
            created_by: req.user?._id,
        });

        res.status(201).json({
            success: true,
            message: "Tạo user package thành công",
            data: userPackage,
        });
    } catch (error) {
        console.error("Lỗi tạo user package:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi tạo user package",
            error: error.message,
        });
    }
};

export const createOrder = async (req, res) => {
    try {
        const userId = req.user?._id;
        const {
            packageType,
            pages,
            employees,
            duration,
            totalPrice,
            discountCode,
            includeVAT,
            taxCode,
            companyName,      // chưa có → null tại bước checkout
        } = req.body;

        // 1. Lấy package_id từ bảng Package
        const pkg = await Package.findOne({
            name: { $regex: packageType, $options: "i" },
        });

        if (!pkg) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy gói phần mềm",
            });
        }

        // Tạo UserPackage
        const newUserPackage = await UserPackage.create({
            package_id: pkg._id,
            user_id: userId,
            pages,
            employees,
            status: "pending",
            created_by: userId,
        });

        // Tạo PaymentTransaction
        const newTransaction = await PaymentTransaction.create({
            user_id: userId,
            package_id: pkg._id,
            amount: totalPrice,
            currency: "VND",
            status: "initializing",
            metadata: {
                discountCode,
                includeVAT,
                taxCode,
                companyName,
                pages,
                employees,
                duration,
            },
            created_by: userId,
        });

        return res.status(201).json({
            success: true,
            message: "Tạo đơn hàng thành công",
            userPackage: newUserPackage,
            transaction: newTransaction,
        });

    } catch (error) {
        console.error("Lỗi tạo đơn hàng:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi tạo đơn hàng",
            error: error.message,
        });
    }
};

export const getUserPackages = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            user_id,
            package_id,
            status,
        } = req.query;

        const filter = {};

        if (user_id) filter.user_id = user_id;
        if (package_id) filter.package_id = package_id;
        if (status) filter.status = status;

        const data = await UserPackage.find(filter)
            .populate("user_id", "name email")
            .populate("package_id", "name price duration pages employees")
            .populate("salesman_id", "name email")
            .sort({ created_at: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await UserPackage.countDocuments(filter);

        res.status(200).json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data,
        });
    } catch (error) {
        console.error("Lỗi lấy danh sách user package:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi lấy danh sách user package",
            error: error.message,
        });
    }
};

/**
 * 🟡 Lấy chi tiết theo ID
 */
export const getUserPackageById = async (req, res) => {
    try {
        const data = await UserPackage.findById(req.params.id)
            .populate("user_id", "name email")
            .populate("package_id", "name price");

        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy user package",
            });
        }

        res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        console.error("Lỗi lấy chi tiết user package:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi lấy chi tiết user package",
            error: error.message,
        });
    }
};

export const getMyPackage = async (req, res) => {
  try {
    const entitlements = await getUserEntitlements(req.user._id, {
      forceRefresh: true,
    });

    if (!entitlements) {
      return res.status(200).json({
        success: true,
        data: null,
        message: "Chưa có gói dịch vụ",
      });
    }

    res.json({
      success: true,
      data: entitlements,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 🟢 Update UserPackage
 */
export const updateUserPackage = async (req, res) => {
    try {
        const data = req.body;

        const updated = await UserPackage.findByIdAndUpdate(
            req.params.id,
            {
                ...data,
                updated_by: req.user?._id,
            },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy user package",
            });
        }

        res.status(200).json({
            success: true,
            message: "Cập nhật user package thành công",
            data: updated,
        });
    } catch (error) {
        console.error("Lỗi cập nhật user package:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi cập nhật user package",
            error: error.message,
        });
    }
};

/**
 * 🔴 Delete (soft delete)
 */
export const deleteUserPackage = async (req, res) => {
    try {
        const deleted = await UserPackage.findByIdAndUpdate(
            req.params.id,
            {
                deleted_at: new Date(),
                updated_by: req.user?._id,
            },
            { new: true }
        );

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy user package",
            });
        }

        res.status(200).json({
            success: true,
            message: "Xóa user package thành công",
        });
    } catch (error) {
        console.error("Lỗi xóa user package:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi xóa user package",
            error: error.message,
        });
    }
};