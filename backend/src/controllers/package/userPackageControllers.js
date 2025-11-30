import UserPackage from "../../models/userPackage.model.js";
import PaymentTransaction from "../../models/paymentTransaction.model.js";
import Package from "../../models/package.model.js";
import User from "../../models/user.model.js";
import { getUserEntitlements } from "../../services/entitlementService.js";

/**
 * Helper: Compute segment for a user package (matches FE logic in mapUserPackageData)
 */
const computeSegment = (userPackage) => {
  if (!userPackage.from_date || !userPackage.to_date) return "noIssue";

  const now = new Date();
  const fromDate = new Date(userPackage.from_date);
  const toDate = new Date(userPackage.to_date);
  const daysUntilExpiry = Math.ceil((toDate - now) / (1000 * 60 * 60 * 24));
  const daysSinceExpiry = Math.ceil((now - toDate) / (1000 * 60 * 60 * 24));
  const daysSinceSignup = Math.ceil((now - fromDate) / (1000 * 60 * 60 * 24));

  // New Signup: mới mua ≤ 7 ngày
  if (daysSinceSignup <= 7) return "newSignup";

  // Recently Expired: đã hết hạn trong vòng 14 ngày gần đây
  if (toDate < now && daysSinceExpiry <= 14) return "recentlyExpired";

  // Expiring Soon: còn ≤ 7 ngày và chưa hết hạn
  if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) return "expiringSoon";

  // No Issue: các trường hợp khác
  return "noIssue";
};

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

        // 1. Lấy package_id từ bảng Package (phải match cả name và planType)
        // Map duration từ UI sang planType trong DB
        const planType = duration === "12months" || duration === "1year" ? "12months" : "3months";

        const pkg = await Package.findOne({
            name: { $regex: packageType, $options: "i" },
            planType: planType,
            status: "active",
            deleted_at: null,
        });

        if (!pkg) {
            return res.status(404).json({
                success: false,
                message: `Không tìm thấy gói phần mềm ${packageType} với thời hạn ${duration}`,
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
            limit = 25,
            user_id,
            package_name,
            segment,
            user_status,
            assigned_status,
            search,
        } = req.query;

        const filter = {};

        if (user_id) filter.user_id = user_id;
        if (assigned_status && assigned_status !== "All") {
            if (assigned_status === "Assigned") {
                filter.salesman_id = { $ne: null };
            } else if (assigned_status === "Unassigned") {
                filter.salesman_id = null;
            }
        }

                // Support package_id (preferred) or package_name (fallback)
                if (req.query.package_id) {
                    filter.package_id = req.query.package_id;
                } else if (package_name && package_name !== "All") {
                    // Try exact-match first, then fallback to contains
                    const exact = await Package.findOne({
                        name: { $regex: `^${package_name}$`, $options: "i" },
                        deleted_at: null,
                    });
                    if (exact) {
                        filter.package_id = exact._id;
                    } else {
                        const fuzzy = await Package.findOne({
                            name: { $regex: package_name, $options: "i" },
                            deleted_at: null,
                        });
                        if (fuzzy) filter.package_id = fuzzy._id;
                    }
                }

                // Load all matching records (apply DB-side filters) and perform post-filters in-memory
                const all = await UserPackage.find(filter)
                        .populate("user_id", "full_name name email phone status")
                        .populate("package_id", "name price duration pages employees")
                        .populate("salesman_id", "full_name name email")
                        .sort({ created_at: -1 });

                // Apply segment filtering & user_status filtering post-fetch (segment requires date logic)
                let filtered = all;

                if (segment && segment !== "All") {
                    filtered = filtered.filter(up => computeSegment(up) === segment);
                }

                if (user_status && user_status !== "All") {
                    filtered = filtered.filter(up => {
                        const userStatus = up.user_id?.status || "active";
                        return userStatus.toLowerCase() === user_status.toLowerCase();
                    });
                }

                // Search in name, email, phone
                if (search && search.trim()) {
                    const s = search.toLowerCase();
                    filtered = filtered.filter(up => {
                        const user = up.user_id || {};
                        return (
                            (user.full_name || "").toLowerCase().includes(s) ||
                            (user.email || "").toLowerCase().includes(s) ||
                            (user.phone || "").toLowerCase().includes(s)
                        );
                    });
                }

                // Pagination in-memory so total reflects post-filters
                const total = filtered.length;
                const start = (page - 1) * limit;
                const end = start + Number(limit);
                const pageData = filtered.slice(start, end);

                res.status(200).json({
                        success: true,
                        total,
                        page: Number(page),
                        pages: Math.ceil(total / limit),
                        data: pageData,
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

export const getUserStatuses = async (req, res) => {
    try {
        const statuses = await User.distinct("status", { deleted_at: null });
        const statusList = statuses
            .filter(s => s && typeof s === "string")
            .sort();

        res.status(200).json({
            success: true,
            data: statusList,
        });
    } catch (error) {
        console.error("Lỗi lấy danh sách user status:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi lấy danh sách user status",
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
            .populate("user_id", "full_name name email phone")
            .populate("package_id", "name price")
            .populate("salesman_id", "full_name name email");

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

        const oldUserPackage = await UserPackage.findById(req.params.id);
        if (!oldUserPackage) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy user package",
            });
        }

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

        // Nếu status được cập nhật thành active, đồng bộ shop packages
        if (data.status === "active" || (updated.status === "active" && oldUserPackage.status !== "active")) {
            try {
                const { syncShopPackagesWithOwner } = await import("../../services/shopPackageSyncService.js");
                await syncShopPackagesWithOwner(updated.user_id.toString());
            } catch (syncError) {
                console.error("⚠️ Lỗi khi sync shop packages:", syncError);
                // Không throw error để không ảnh hưởng đến flow chính
            }
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