import PaymentTransaction from "../../models/transaction/paymentTransaction.model.js";
import UserPackage from "../../models/package/userPackage.model.js";
import User from "../../models/user/user.model.js";
import Package from "../../models/package/package.model.js";
import mongoose from "mongoose";
import { queuePackageApprovalEmail } from "../../services/email/emailService.js";
import { createInvoice } from "../invoice/invoiceControllers.js";


export const createPaymentTransaction = async (req, res) => {
  try {
    const data = req.body;

    const transaction = await PaymentTransaction.create({
      ...data,
      user_id: req.user?._id,
      created_by: req.user?._id,
    });

    res.status(201).json({
      success: true,
      message: "Tạo giao dịch thành công",
      data: transaction,
    });
  } catch (error) {
    console.error("Lỗi tạo giao dịch:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi tạo giao dịch",
      error: error.message,
    });
  }
};

/**
 * 🟡 Lấy danh sách giao dịch (có phân trang + filter)
 */
export const getPaymentTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      status,
      user_id,
      package_id,
      method,
      assigned_status,
      search,
      startDate,
      endDate,
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build aggregation pipeline
    const pipeline = [
      { $match: { deleted_at: null } },
      {
        $lookup: {
          from: "users",
          localField: "user_id",
          foreignField: "_id",
          as: "user_id",
        },
      },
      { $unwind: { path: "$user_id", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "packages",
          localField: "package_id",
          foreignField: "_id",
          as: "package_id",
        },
      },
      { $unwind: { path: "$package_id", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "assigned_to",
          foreignField: "_id",
          as: "assigned_to",
        },
      },
      { $unwind: { path: "$assigned_to", preserveNullAndEmptyArrays: true } },
    ];

    // Build match stage for filters
    const matchStage = { $match: {} };

    if (status) matchStage.$match.status = status;
    if (user_id) {
      if (mongoose.Types.ObjectId.isValid(user_id)) {
        matchStage.$match["user_id._id"] = new mongoose.Types.ObjectId(user_id);
      } else {
        matchStage.$match["user_id._id"] = user_id;
      }
    }
    if (method) {
      // Match method case-insensitively because frontend may send different casing
      matchStage.$match.method = { $regex: `^${method}$`, $options: 'i' };
    }

    // assigned_status filter: 'assigned' | 'unassigned'
    if (assigned_status) {
      if (String(assigned_status).toLowerCase() === 'assigned') {
        matchStage.$match.assigned_to = { $ne: null };
      } else if (String(assigned_status).toLowerCase() === 'unassigned') {
        matchStage.$match.assigned_to = null;
      }
    }

    // Handle package_id filter
    if (package_id) {
      if (mongoose.Types.ObjectId.isValid(package_id)) {
        matchStage.$match["package_id._id"] = new mongoose.Types.ObjectId(package_id);
      } else {
        // Find package by name (case-insensitive match)
        const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
        const pkg = await Package.findOne({ name: { $regex: `^${escapeRegex(package_id)}$`, $options: 'i' } });
        if (!pkg) {
          return res.status(200).json({
            success: true,
            total: 0,
            page: pageNum,
            pages: 0,
            data: [],
          });
        }
        matchStage.$match["package_id._id"] = pkg._id;
      }
    }

    // Handle date range - parse dd/mm/yyyy format
    if (startDate || endDate) {
      matchStage.$match.payment_at = {};
      
      const parseDate = (dateStr) => {
        if (!dateStr || typeof dateStr !== 'string') return null;
        // Parse dd/mm/yyyy format
        const parts = dateStr.trim().split('/');
        if (parts.length !== 3) return null;
        
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        
        if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
        
        const date = new Date(year, month - 1, day);
        return date;
      };
      
      if (startDate) {
        const start = parseDate(startDate);
        if (start && !isNaN(start)) {
          start.setHours(0, 0, 0, 0);
          matchStage.$match.payment_at.$gte = start;
        }
      }
      
      if (endDate) {
        const end = parseDate(endDate);
        if (end && !isNaN(end)) {
          end.setHours(23, 59, 59, 999);
          matchStage.$match.payment_at.$lte = end;
        }
      }
    }

    // Handle search
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      matchStage.$match.$or = [
        { "user_id.full_name": searchRegex },
        { "user_id.email": searchRegex },
        { "user_id.phone": searchRegex },
        { "provider_ref": searchRegex },
        { "_id": mongoose.Types.ObjectId.isValid(search) ? new mongoose.Types.ObjectId(search) : null },
      ].filter(cond => Object.values(cond)[1] !== null);
    }

    pipeline.push(matchStage);

    // Add sort and pagination
    pipeline.push({ $sort: { created_at: -1 } });
    
    // Get total count before pagination
    const countResult = await PaymentTransaction.aggregate([
      ...pipeline.slice(0, pipeline.length - 1), // Remove sort before counting
      { $count: "total" },
    ]);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    // Add pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limitNum });

    // Project to get only needed fields
    pipeline.push({
      $project: {
        _id: 1,
        user_id: { _id: 1, full_name: 1, email: 1, phone: 1, facebookId: 1 },
        package_id: { _id: 1, name: 1, price: 1, planType: 1 },
        assigned_to: { _id: 1, full_name: 1, email: 1, phone: 1 },
        status: 1,
        method: 1,
        amount: 1,
        currency: 1,
        provider_ref: 1,
        payment_at: 1,
        created_at: 1,
        updated_at: 1,
        metadata: 1,
      },
    });

    const transactions = await PaymentTransaction.aggregate(pipeline);

    res.status(200).json({
      success: true,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data: transactions,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách giao dịch:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy danh sách giao dịch",
      error: error.message,
    });
  }
};

/**
 * 🟢 Lấy danh sách giá trị filter (packages, methods, statuses)
 */
export const getPaymentTransactionFilters = async (req, res) => {
  try {
    // Lấy distinct packages
    const packageIds = await PaymentTransaction.distinct("package_id", { deleted_at: null });
    const packages = await Promise.all(
      packageIds
        .filter(id => id != null)
        .map(id => 
          PaymentTransaction.findOne({ package_id: id, deleted_at: null }).populate("package_id", "name")
        )
    );
    const packageNames = packages
      .filter(txn => txn?.package_id)
      .map(txn => txn.package_id.name)
      .filter((v, i, arr) => arr.indexOf(v) === i) // Remove duplicates
      .sort();

    // Lấy distinct payment methods
    const methods = await PaymentTransaction.distinct("method", { deleted_at: null });
    const methodsList = (methods || [])
      .filter(m => m != null)
      .sort();

    // Lấy distinct statuses
    const statuses = await PaymentTransaction.distinct("status", { deleted_at: null });
    const statusesList = (statuses || [])
      .filter(s => s != null)
      .sort();

    res.status(200).json({
      success: true,
      data: {
        packages: packageNames,
        methods: methodsList,
        statuses: statusesList,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy filter values:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy filter values",
      error: error.message,
    });
  }
};

/**
 * 🟡 Lấy chi tiết giao dịch theo ID
 */
export const getPaymentTransactionById = async (req, res) => {
  try {
    const transaction = await PaymentTransaction.findById(req.params.id)
      .populate("user_id", "_id full_name email phone")
      .populate("package_id", "name price")
      .populate("assigned_to", "_id full_name email phone");

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy giao dịch",
      });
    }

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error("Lỗi lấy chi tiết giao dịch:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy chi tiết giao dịch",
      error: error.message,
    });
  }
};

export const updatePaymentTransaction = async (req, res) => {
  try {
    const data = req.body;
    
    // Lấy transaction hiện tại để lấy user_id và package_id
    const currentTransaction = await PaymentTransaction.findById(req.params.id);
    if (!currentTransaction) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy giao dịch",
      });
    }

    // Nếu có metadata trong request, cần merge với metadata hiện tại thay vì replace
    let updateData = { ...data };
    if (data.metadata && typeof data.metadata === 'object') {
      updateData.metadata = {
        ...(currentTransaction.metadata || {}),
        ...data.metadata,
      };
    }

    const transaction = await PaymentTransaction.findByIdAndUpdate(
      req.params.id,
      {
        ...updateData,
        updated_by: req.user?._id || null,
      },
      { new: true, runValidators: true }
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy giao dịch",
      });
    }

    // ✅ Cập nhật status của UserPackage khi approve/reject transaction
    if (data.status === "success" || data.status === "canceled" || data.status === "rejected") {
      try {
        // Tìm UserPackage có user_id và package_id tương ứng
        // - Khi approve: chỉ tìm status = "pending"
        // - Khi reject: tìm status = "pending" hoặc "active" (nếu đã approve trước đó)
        const statusFilter = data.status === "success" 
          ? { status: "pending" }
          : { status: { $in: ["pending", "active"] } };
        
        // Tìm UserPackage mới nhất (theo created_at) để tránh trường hợp có nhiều UserPackage
        const userPackage = await UserPackage.findOne({
          user_id: currentTransaction.user_id,
          package_id: currentTransaction.package_id,
          ...statusFilter,
        }).sort({ created_at: -1 });

        if (userPackage) {
          // Update status của UserPackage
          const newStatus = data.status === "success" ? "active" : "cancelled";
          
          // Nếu approve (success), cần set from_date và to_date nếu chưa có
          const userPackageUpdateData = {
            status: newStatus,
            updated_by: req.user?._id || null,
          };

          if (data.status === "success" && !userPackage.from_date) {
            // Set from_date = hiện tại, to_date dựa trên duration trong metadata
            const duration = currentTransaction.metadata?.duration || "12months";
            const durationDays = duration === "12months" ? 365 : duration === "6months" ? 180 : 90;
            
            userPackageUpdateData.from_date = new Date();
            userPackageUpdateData.to_date = new Date();
            userPackageUpdateData.to_date.setDate(userPackageUpdateData.to_date.getDate() + durationDays);
          }

          const updatedUserPackage = await UserPackage.findByIdAndUpdate(
            userPackage._id,
            userPackageUpdateData,
            { new: true }
          );

          console.log(`✅ Đã cập nhật UserPackage ${userPackage._id} status từ "${userPackage.status}" thành "${newStatus}"`);

          // Nếu payment thành công, disable tất cả package cũ của user
          if (data.status === "success") {
            try {
              // Tìm tất cả package active khác của user (không phải package mới này)
              const oldActivePackages = await UserPackage.find({
                user_id: currentTransaction.user_id,
                _id: { $ne: userPackage._id }, // Loại trừ package mới
                status: { $in: ["active", "expiring soon", "new signup"] },
                deleted_at: null,
              });

              if (oldActivePackages.length > 0) {
                // Disable tất cả package cũ
                await UserPackage.updateMany(
                  {
                    user_id: currentTransaction.user_id,
                    _id: { $ne: userPackage._id },
                    status: { $in: ["active", "expiring soon", "new signup"] },
                    deleted_at: null,
                  },
                  {
                    $set: {
                      status: "canceled",
                      updated_by: req.user?._id || null,
                    },
                  }
                );

                console.log(`✅ Đã disable ${oldActivePackages.length} package cũ của user ${currentTransaction.user_id}`);
              }

              // Đồng bộ package cho tất cả shop của owner
              try {
                const { syncShopPackagesWithOwner } = await import("../../services/shopPackageSyncService.js");
                await syncShopPackagesWithOwner(currentTransaction.user_id);
              } catch (syncError) {
                console.error("⚠️ Lỗi khi sync shop packages:", syncError);
                // Không throw error để không ảnh hưởng đến flow chính
              }

              // Gửi email thông báo khi package được approve (fire-and-forget)
              try {
                const user = await User.findById(currentTransaction.user_id).select("email full_name");
                const packageInfo = await Package.findById(currentTransaction.package_id).select("name price planType pages employees shops features");

                if (user && user.email && packageInfo) {
                  const duration = currentTransaction.metadata?.duration || "12months";
                  const packageData = {
                    packageName: packageInfo.name,
                    price: packageInfo.price,
                    duration: duration,
                    fromDate: updatedUserPackage.from_date || userPackageUpdateData.from_date,
                    toDate: updatedUserPackage.to_date || userPackageUpdateData.to_date,
                    pages: updatedUserPackage.pages || userPackage.pages || packageInfo.pages,
                    employees: updatedUserPackage.employees || userPackage.employees || packageInfo.employees,
                    shops: updatedUserPackage.shops || userPackage.shops || packageInfo.shops,
                    features: packageInfo.features || [],
                  };

                  queuePackageApprovalEmail(
                    user.email,
                    user.full_name || "Khách hàng",
                    packageData
                  );
                  console.log(`📧 Email thông báo kích hoạt gói đã được queue cho ${user.email}`);
                } else {
                  console.log(`⚠️ Không thể gửi email: user hoặc package không tìm thấy hoặc user không có email`);
                }
              } catch (emailError) {
                console.error("Lỗi queue email thông báo kích hoạt gói:", emailError);
                // Không throw error để không ảnh hưởng đến response
              }

              // Tạo invoice tự động khi transaction thành công
              try {
                const invoice = await createInvoice(req.params.id);
                console.log(`✅ Đã tạo invoice ${invoice.invoice_number} cho transaction ${req.params.id}`);
              } catch (invoiceError) {
                console.error("Lỗi tạo invoice:", invoiceError);
                // Không throw error để không ảnh hưởng đến response
              }
            } catch (disableError) {
              console.error("Lỗi disable package cũ:", disableError);
              // Không throw error để không ảnh hưởng đến response
            }
          }
        } else {
          console.log(`⚠️ Không tìm thấy UserPackage phù hợp cho user ${currentTransaction.user_id} và package ${currentTransaction.package_id}`);
        }
      } catch (userPackageError) {
        console.error("Lỗi cập nhật UserPackage:", userPackageError);
        // Không throw error để không ảnh hưởng đến response của transaction
      }
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật giao dịch thành công",
      data: transaction,
    });
  } catch (error) {
    console.error("Lỗi cập nhật giao dịch:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi cập nhật giao dịch",
      error: error.message,
    });
  }
};

export const setPaymentMethod = async (req, res) => {
  try {
    const { method } = req.body;
    console.log("SET METHOD CALLED");
    console.log("ID nhận được:", req.params.id);
    console.log("Valid ObjectId?", mongoose.Types.ObjectId.isValid(req.params.id));
    console.log("User:", req.user?._id);
    const id = req.params.id;
    const objectId = new mongoose.Types.ObjectId(id);

    // Prepare update data
    const updateData = {
      method,
      updated_by: req.user._id,
    };

    // Nếu method là "manual banking", set expired_date (10 phút từ bây giờ)
    if (method === "manual banking") {
      const expiredDate = new Date();
      expiredDate.setMinutes(expiredDate.getMinutes() + 10);
      updateData.expired_date = expiredDate;
    }

    const updated = await PaymentTransaction.findByIdAndUpdate(
      objectId,
      updateData,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy giao dịch",
      });
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật phương thức thanh toán thành công",
      data: updated,
    });
  } catch (error) {
    console.error("Lỗi cập nhật method:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi cập nhật method thanh toán",
      error: error.message,
    });
  }
};

export const confirmBankTransfer = async (req, res) => {
  try {
    const updated = await PaymentTransaction.findByIdAndUpdate(
      req.params.id,
      {
        status: "pending",
        payment_at: new Date(),
        updated_by: req.user._id,
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy giao dịch",
      });
    }

    res.status(200).json({
      success: true,
      message: "Xác nhận chuyển khoản thành công",
      data: updated,
    });
  } catch (error) {
    console.error("Lỗi confirm bank:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi xác nhận chuyển khoản",
      error: error.message,
    });
  }
};

export const deletePaymentTransaction = async (req, res) => {
  try {
    const transaction = await PaymentTransaction.findByIdAndUpdate(
      req.params.id,
      {
        deleted_at: new Date(),
        updated_by: req.user?._id || null,
      },
      { new: true }
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy giao dịch",
      });
    }

    res.status(200).json({
      success: true,
      message: "Xóa giao dịch thành công",
    });
  } catch (error) {
    console.error("Lỗi xóa giao dịch:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi xóa giao dịch",
      error: error.message,
    });
  }
};