import Log from "../models/log.model.js";
import User from "../models/user.model.js";
import UserRole from "../models/userRole.model.js";
import Role from "../models/role.model.js";
import Shop from "../models/shops/shop.model.js";

// 📋 Lấy danh sách customer logs (logs liên quan đến customers/users không có internal_role)
export const getCustomerLogs = async (req, res) => {
  try {
    // Lấy tất cả logs có target_type liên quan đến customers
    // Bao gồm: User, Shop, FacebookPage, UserRole, ShopUser, Campaign
    const logs = await Log.find({
      target_type: { $in: ["User", "Shop", "FacebookPage", "UserRole", "ShopUser", "Campaign"] },
    })
      .populate("user_id", "full_name email status internal_role")
      .populate("shop_id", "shop_name")
      .sort({ created_at: -1 }) // Mới nhất trước
      .limit(1000) // Tăng limit lên 1000 logs
      .lean();

    // Lọc logs chỉ lấy những logs liên quan đến customers (users không có internal_role)
    const filteredLogs = logs.filter(
      (log) => !log.user_id || !log.user_id.internal_role
    );

    // Lấy tất cả user_id và shop_id để query một lần
    const userIds = [...new Set(filteredLogs.map((log) => log.user_id?._id).filter(Boolean))];
    const shopIds = [...new Set(filteredLogs.map((log) => log.shop_id?._id).filter(Boolean))];

    // Query tất cả UserRole và Shop một lần
    const userRoles = await UserRole.find({
      user_id: { $in: userIds },
      shop_id: { $in: shopIds },
      revoked_at: null,
    })
      .populate("role_id", "role_name")
      .lean();

    const shops = await Shop.find({
      _id: { $in: shopIds },
    })
      .select("_id owner_id")
      .lean();

    // Tạo map để lookup nhanh
    const userRoleMap = new Map();
    userRoles.forEach((ur) => {
      const userId = ur.user_id?._id?.toString() || ur.user_id?.toString();
      const shopId = ur.shop_id?._id?.toString() || ur.shop_id?.toString();
      if (userId && shopId) {
        const key = `${userId}_${shopId}`;
        userRoleMap.set(key, ur.role_id?.role_name || "N/A");
      }
    });

    const shopOwnerMap = new Map();
    shops.forEach((shop) => {
      if (shop.owner_id) {
        shopOwnerMap.set(shop._id.toString(), shop.owner_id.toString());
      }
    });

    // Format logs
    const customerLogs = filteredLogs.map((log) => {
      let roleName = "N/A";
      let userStatus = "Active";

      if (log.user_id) {
        userStatus =
          log.user_id.status === "active"
            ? "Active"
            : log.user_id.status === "inactive"
            ? "Inactive"
            : log.user_id.status === "banned"
            ? "Banned"
            : "Active";

        // Lấy role từ map
        if (log.shop_id && log.user_id._id) {
          const userId = log.user_id._id.toString();
          const shopId = log.shop_id._id?.toString() || log.shop_id.toString();
          const key = `${userId}_${shopId}`;
          roleName = userRoleMap.get(key) || "N/A";

          // Nếu không có role, kiểm tra xem có phải owner không
          if (roleName === "N/A" && log.shop_id._id) {
            const ownerId = shopOwnerMap.get(log.shop_id._id.toString());
            if (ownerId && ownerId === log.user_id._id.toString()) {
              roleName = "Shop Owner";
            }
          }
        }
      }

      return {
        _id: log._id,
        user: log.user_name || log.user_id?.full_name || "N/A",
        userId: log.user_id?._id?.toString() || log.user_id || "N/A",
        shopName: log.shop_name || log.shop_id?.shop_name || "N/A",
        shopId: log.shop_id?._id?.toString() || log.shop_id?.toString() || "N/A",
        time: log.created_at,
        role: roleName,
        userStatus: userStatus,
        event: log.description || log.action || "-",
        action: log.action,
        description: log.description,
      };
    });

    // Sort lại từ mới đến cũ (theo created_at)
    customerLogs.sort((a, b) => {
      const timeA = a.time ? new Date(a.time).getTime() : 0;
      const timeB = b.time ? new Date(b.time).getTime() : 0;
      return timeB - timeA; // Mới nhất trước (descending)
    });

    res.status(200).json({
      success: true,
      data: customerLogs,
    });
  } catch (error) {
    console.error("❌ Get customer logs error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy customer logs.",
    });
  }
};

