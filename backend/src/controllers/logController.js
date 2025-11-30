import Log from "../models/log.model.js";
import User from "../models/user.model.js";
import UserRole from "../models/userRole.model.js";
import Role from "../models/role.model.js";
import Shop from "../models/shops/shop.model.js";
import mongoose from "mongoose";

// 📋 Lấy danh sách customer logs (logs liên quan đến customers/users không có internal_role)
// 📋 Lấy danh sách customer logs (logs liên quan đến customers/users không có internal_role)
export const getCustomerLogs = async (req, res) => {
  try {
    const { page = 1, search = "", dateRange } = req.query;
    const limit = parseInt(req.query.limit) || 10;

    const pipeline = [
      // 1. Filter by target_type first
      {
        $match: {
          target_type: { $in: ["User", "Shop", "FacebookPage", "UserRole", "ShopUser", "Campaign"] }
        }
      },
      // 2. Lookup user info
      {
        $lookup: {
          from: "users",
          localField: "user_id",
          foreignField: "_id",
          as: "user_info"
        }
      },
      {
        $unwind: {
          path: "$user_info",
          preserveNullAndEmptyArrays: true
        }
      },
      // 3. Filter out internal staff logs (keep only customers or system logs related to customers)
      {
        $match: {
          $or: [
            { "user_info.internal_role": { $exists: false } },
            { "user_info.internal_role": null }
          ]
        }
      },
      // 4. Lookup shop info
      {
        $lookup: {
          from: "shops",
          localField: "shop_id",
          foreignField: "_id",
          as: "shop_info"
        }
      },
      {
        $unwind: {
          path: "$shop_info",
          preserveNullAndEmptyArrays: true
        }
      }
    ];

    // 5. Apply Search Filter
    if (search) {
      const searchRegex = new RegExp(search, "i");
      pipeline.push({
        $match: {
          $or: [
            { "user_info.full_name": searchRegex },
            { "user_info.email": searchRegex },
            { "shop_info.shop_name": searchRegex },
            { description: searchRegex },
            { action: searchRegex }
          ]
        }
      });
    }

    // 6. Apply Date Range Filter
    if (dateRange && dateRange.includes("-")) {
      const [startStr, endStr] = dateRange.split("-").map(s => s.trim());
      const parseDate = (d) => {
        const [dd, mm, yyyy] = d.split("/").map(Number);
        return new Date(yyyy, mm - 1, dd);
      };

      const startDate = parseDate(startStr);
      const endDate = parseDate(endStr);
      endDate.setHours(23, 59, 59, 999);

      pipeline.push({
        $match: {
          created_at: { $gte: startDate, $lte: endDate }
        }
      });
    }

    // 7. Count total before pagination
    const countPipeline = [...pipeline, { $count: "total" }];
    const [countResult] = await Log.aggregate(countPipeline);
    const total = countResult ? countResult.total : 0;

    // 8. Apply Pagination and Sort
    const lastLogId = req.query.lastLogId;

    if (lastLogId && mongoose.isValidObjectId(lastLogId)) {
      // when sorting by created_at descending, fetch older logs by _id < lastLogId
      pipeline.push({ $match: { _id: { $lt: new mongoose.Types.ObjectId(lastLogId) } } });
    }
    pipeline.push(
      { $sort: { created_at: -1 } },
      { $limit: limit }
    );

    const logs = await Log.aggregate(pipeline);

    // 9. Post-process to get roles (UserRole lookup is complex in aggregation, doing it separately for the page is okay or lookup here)
    // To keep it simple and performant, we can do a second lookup for roles for the fetched logs only

    // Extract userIds and shopIds from the paginated result
    const userIds = [...new Set(logs.map(log => log.user_id).filter(Boolean))];
    const shopIds = [...new Set(logs.map(log => log.shop_id).filter(Boolean))];

    // Fetch roles
    const userRoles = await UserRole.find({
      user_id: { $in: userIds },
      shop_id: { $in: shopIds },
      revoked_at: null,
    }).populate("role_id", "role_name").lean();

    const shops = await Shop.find({ _id: { $in: shopIds } }).select("_id owner_id").lean();

    // Create maps
    const userRoleMap = new Map();
    userRoles.forEach((ur) => {
      const key = `${ur.user_id}_${ur.shop_id}`;
      userRoleMap.set(key, ur.role_id?.role_name || "N/A");
    });

    const shopOwnerMap = new Map();
    shops.forEach((shop) => {
      if (shop.owner_id) {
        shopOwnerMap.set(shop._id.toString(), shop.owner_id.toString());
      }
    });

    // Format logs
    const formattedLogs = logs.map((log) => {
      let roleName = "N/A";
      let userStatus = "Active";

      if (log.user_info) {
        userStatus = log.user_info.status === "active" ? "Active" :
          log.user_info.status === "banned" ? "Banned" : "Inactive";

        if (log.shop_id && log.user_id) {
          const key = `${log.user_id}_${log.shop_id}`;
          roleName = userRoleMap.get(key) || "N/A";

          if (roleName === "N/A") {
            const ownerId = shopOwnerMap.get(log.shop_id.toString());
            if (ownerId && ownerId === log.user_id.toString()) {
              roleName = "Shop Owner";
            }
          }
        }
      }

      return {
        _id: log._id,
        user: log.user_name || log.user_info?.full_name || "N/A",
        userId: log.user_id || "N/A",
        shopName: log.shop_name || log.shop_info?.shop_name || "N/A",
        shopId: log.shop_id || "N/A",
        time: log.created_at,
        role: roleName,
        userStatus: userStatus,
        event: log.description || log.action || "-",
        action: log.action,
        description: log.description,
      };
    });

    res.status(200).json({
      success: true,
      data: formattedLogs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error("❌ Get customer logs error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy customer logs.",
      error: error.message
    });
  }
};
