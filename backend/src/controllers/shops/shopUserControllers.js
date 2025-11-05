import ShopUser from "../../models/shops/shopUser.model.js";
import UserRole from "../../models/userRole.model.js";
import User from "../../models/user.model.js";
import Role from "../../models/role.model.js";
import jwt from "jsonwebtoken";
import Shop from "../../models/shops/shop.model.js";
import { sendInvitationEmail } from "../../services/emailService.js";

// Thêm User vào Shop
export const createShopUser = async (req, res) => {
  try {
    const shopUser = new ShopUser(req.body);
    await shopUser.save();
    res.status(201).json(shopUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const inviteEmployee = async (req, res) => {
  try {
    // 1. Lấy thêm `shopId` từ req.body
    const { email, roleId, invitedBy, shopId } = req.body;

    // 2. Thêm `shopId` vào phần kiểm tra
    if (!email || !roleId || !invitedBy || !shopId) {
      return res.status(400).json({ success: false, message: "Thiếu dữ liệu đầu vào (email, roleId, invitedBy, shopId)" });
    }

    // Kiểm tra user tồn tại chưa
    let user = await User.findOne({ email });

    if (!user) {
      // Gửi email mời
      await sendInvitationEmail(email);

      return res.status(200).json({
        success: true,
        message: "Đã gửi email mời nhân viên mới.",
        invitedEmail: email,
      });
    }

    // Nếu user đã tồn tại → thêm trực tiếp vào Shop
    if (user.status === "pending") {
      return res.status(400).json({
        success: false,
        message: "Người dùng chưa hoàn tất đăng ký. Vui lòng chờ họ hoàn tất đăng ký qua email mời.",
      });
    }

    // Kiểm tra xem nhân viên đã có trong shop chưa
    const existingShopUser = await ShopUser.findOne({ shop_id: shopId, user_id: user._id });
    if (existingShopUser) {
      return res.status(409).json({ // 409 Conflict
        success: false,
        message: "Nhân viên này đã có trong shop.",
      });
    }

    // Tạo ShopUser
    const shopUser = await ShopUser.create({
      shop_id: shopId,
      user_id: user._id,
      invited_by: invitedBy,
      status: "active",
    });

    // Tạo UserRole
    await UserRole.create({
      user_id: user._id,
      shop_id: shopId,
      role_id: roleId,
    });

    return res.status(201).json({
      success: true,
      message: "Đã thêm nhân viên vào shop.",
      data: shopUser,
    });
  } catch (error) {
    console.error("inviteEmployee error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi mời nhân viên",
      error: error.message,
    });
  }
};

// Lấy danh sách tất cả ShopUser
export const getShopUsers = async (req, res) => {
  try {
    const shopUsers = await ShopUser.find()
      .populate({
        path: "user_id",
        select: "name email status",
        match: { status: { $ne: "pending" } } // Không lấy user pending
      })
      .populate("shop_id", "shop_name status")
      .lean();
    res.json(shopUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getUsersByShop = async (req, res) => {
  try {
    const { shopId } = req.params;

    // 1. Lấy shop owner từ Shop model
    const shop = await Shop.findById(shopId)
      .populate({
        path: "owner_id",
        select: "full_name username email avatar status"
      })
      .lean();

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy shop"
      });
    }

    // 2. Lấy danh sách ShopUser thuộc shop này (không bao gồm owner)
    const shopUsers = await ShopUser.find({ shop_id: shopId })
      .populate({
        path: "user_id",
        select: "full_name username email avatar status",
        match: { status: { $ne: "pending" } }
      })
      .lean();

    // 3. Lấy danh sách userId (bao gồm cả owner) để query UserRole
    const userIds = shopUsers
      .map(su => su.user_id?._id)
      .filter(Boolean);
    
    // Thêm owner_id vào danh sách nếu có
    if (shop.owner_id && shop.owner_id._id) {
      userIds.push(shop.owner_id._id);
    }

    // 4. Lấy role tương ứng của từng user trong shop này
    const userRoles = await UserRole.find({
      user_id: { $in: userIds },
      shop_id: shopId
    })
      .populate("role_id", "role_name")
      .lean();

    // Lấy role "Shop Owner" để gán cho owner nếu chưa có UserRole
    const ownerRole = await Role.findOne({ role_name: "Shop Owner" }).lean();

    // 5. Tạo object cho shop owner
    const ownerIdStr = shop.owner_id?._id?.toString();
    const ownerUserRole = userRoles.find(
      ur => ur.user_id.toString() === ownerIdStr
    );

    const ownerData = {
      user_id: shop.owner_id?._id || null,
      username: shop.owner_id?.username || "",
      full_name: shop.owner_id?.full_name || "Chưa cập nhật",
      email: shop.owner_id?.email || "",
      avatar: shop.owner_id?.avatar || null,
      role_name: ownerUserRole?.role_id?.role_name || "Shop Owner", // Mặc định là Shop Owner
      page: 0, // Owner có thể có page count = 0 hoặc tính từ shop
      status: "active", // Owner luôn active
      joined_at: shop.created_at || null,
      is_manager: true,
    };

    // 6. Map dữ liệu cho các ShopUser (không phải owner)
    const shopUserData = shopUsers
      .filter(su => {
        // Loại bỏ owner khỏi danh sách ShopUser nếu có
        return su.user_id?._id?.toString() !== ownerIdStr;
      })
      .map(su => {
        const matchedRole = userRoles.find(
          ur => ur.user_id.toString() === su.user_id?._id?.toString()
        );

        return {
          user_id: su.user_id?._id || null,
          username: su.user_id?.username || "",
          full_name: su.user_id?.full_name || "Chưa cập nhật",
          email: su.user_id?.email || "",
          avatar: su.user_id?.avatar || null,
          role_name: matchedRole?.role_id?.role_name || "N/A",
          page: su.page_count || 0,
          status: su.status || "inactive",
          joined_at: su.joined_at || null,
          is_manager: su.is_manager || false,
        };
      });

    // 7. Kết hợp owner và shopUsers, đặt owner lên đầu
    const result = [ownerData, ...shopUserData];

    res.status(200).json({
      success: true,
      count: result.length,
      data: result
    });

  } catch (error) {
    console.error("getUsersByShop error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy danh sách user của shop"
    });
  }
};

// Lấy ShopUser theo ID
export const getShopUserById = async (req, res) => {
  try {
    const shopUser = await ShopUser.findById(req.params.id)
      .populate("shop_id", "shop_name")
      .populate("user_id", "name email");
    if (!shopUser) return res.status(404).json({ message: "ShopUser not found" });
    res.json(shopUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Lấy tất cả shop mà user đang tham gia
export const getShopsByUser = async (req, res) => {
  try {
    const userId = req.params.userId; // hoặc req.user._id nếu đang login

    const memberships = await ShopUser.find({
      user_id: userId,
      status: "active"
    })
      .populate("shop_id", "shop_name industry status") // populate sang Shop
      .populate("invited_by", "name email"); // optional

    // Lọc ra chỉ phần shop cho gọn
    const shops = memberships.map(m => m.shop_id);

    res.status(200).json({ success: true, count: shops.length, data: shops });
  } catch (error) {
    console.error("getShopsByUser error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống" });
  }
};

// Update ShopUser
export const updateShopUser = async (req, res) => {
  try {
    const shopUser = await ShopUser.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!shopUser) return res.status(404).json({ message: "ShopUser not found" });
    res.json(shopUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

//Update user's role
export const updateUserRole = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { userId, newRoleId, currentUserId } = req.body;

    const targetUser = await User.findById(userId);
    if (targetUser?.status === "pending") {
      return res.status(400).json({
        success: false,
        message: "Người dùng chưa hoàn tất đăng ký.",
      });
    }

    // Lấy vai trò của người thao tác (người đang thực hiện hành động)
    const actorRole = await UserRole.findOne({
      shop_id: shopId,
      user_id: currentUserId,
    }).populate("role_id", "role_name");

    if (!actorRole) {
      return res.status(403).json({
        success: false,
        message: "Không tìm thấy vai trò của bạn trong shop này.",
      });
    }

    const actorRoleName = actorRole.role_id.role_name;

    // Lấy role hiện tại của người bị đổi
    const targetRole = await UserRole.findOne({
      shop_id: shopId,
      user_id: userId,
    }).populate("role_id", "role_name");

    if (!targetRole) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy vai trò của người dùng này trong shop.",
      });
    }

    const targetRoleName = targetRole.role_id.role_name;

    // Lấy thông tin role mới
    const newRole = await Role.findById(newRoleId);
    if (!newRole) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy vai trò cần gán.",
      });
    }

    // Không được gán quyền Shop Owner cho người khác
    if (newRole.role_name === "Shop Owner") {
      return res.status(403).json({
        success: false,
        message: "Không thể gán quyền 'Shop Owner' cho người khác.",
      });
    }

    // Kiểm tra quyền ai được đổi ai
    const canChange =
      (actorRoleName === "Shop Owner" &&
        ["Marketing Admin", "Marketer"].includes(targetRoleName)) ||
      (actorRoleName === "Marketing Admin" &&
        (targetRoleName === "Marketer" || userId === currentUserId)); // <--- Cho phép Marketing Admin tự đổi role của mình

    if (!canChange) {
      return res.status(403).json({
        success: false,
        message: `Bạn (${actorRoleName}) không có quyền thay đổi vai trò của ${targetRoleName}.`,
      });
    }

    // Cập nhật role của user trong shop
    const updated = await UserRole.findOneAndUpdate(
      { shop_id: shopId, user_id: userId },
      { role_id: newRoleId },
      { new: true }
    ).populate("role_id", "role_name");

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy user hoặc role cần cập nhật.",
      });
    }

    res.status(200).json({
      success: true,
      message: `Đã cập nhật vai trò của ${targetRoleName} thành ${newRole.role_name}.`,
      data: updated,
    });
  } catch (error) {
    console.error("updateUserRole error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi cập nhật vai trò người dùng: " + error.message,
    });
  }
};

// Cập nhật trạng thái hoạt động của user trong shop (active / inactive / removed)
export const updateUserStatus = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { userId, newStatus, currentUserId } = req.body;

    const targetUser = await User.findById(userId);
    if (targetUser?.status === "pending") {
      return res.status(400).json({
        success: false,
        message: "Người dùng chưa hoàn tất đăng ký.",
      });
    }

    // Lấy role của người đang thao tác (người gửi request)
    const actorRole = await UserRole.findOne({
      shop_id: shopId,
      user_id: currentUserId,
    }).populate("role_id", "role_name");

    if (!actorRole) {
      return res.status(403).json({
        success: false,
        message: "Không tìm thấy vai trò của bạn trong shop này.",
      });
    }

    const actorRoleName = actorRole.role_id.role_name;

    // Lấy role của user bị tác động
    const targetRole = await UserRole.findOne({
      shop_id: shopId,
      user_id: userId,
    }).populate("role_id", "role_name");

    if (!targetRole) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy vai trò của người dùng này trong shop.",
      });
    }

    const targetRoleName = targetRole.role_id.role_name;

    // Không cho tự đổi trạng thái chính mình
    if (userId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: "Không thể thay đổi trạng thái của chính bạn.",
      });
    }

    // Kiểm tra quyền hạn
    const canChange =
      (actorRoleName === "Shop Owner" &&
        ["Marketing Admin", "Marketer"].includes(targetRoleName)) ||
      (actorRoleName === "Marketing Admin" &&
        targetRoleName === "Marketer");

    if (!canChange) {
      return res.status(403).json({
        success: false,
        message: `Bạn (${actorRoleName}) không có quyền thay đổi trạng thái của ${targetRoleName}.`,
      });
    }

    // Kiểm tra trạng thái hợp lệ
    const allowedStatuses = ["active", "inactive", "removed"];
    if (!allowedStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái không hợp lệ.",
      });
    }

    // Cập nhật trạng thái user trong shop
    const updated = await ShopUser.findOneAndUpdate(
      { shop_id: shopId, user_id: userId },
      { status: newStatus },
      { new: true }
    ).populate("user_id", "full_name username email");

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng trong shop.",
      });
    }

    res.status(200).json({
      success: true,
      message: `Đã cập nhật trạng thái của ${targetRoleName} thành '${newStatus}'.`,
      data: updated,
    });
  } catch (error) {
    console.error("updateUserStatus error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi cập nhật trạng thái người dùng.",
    });
  }
};

export const relinquishOwnership = async (req, res) => {
  try {
    const { shopId } = req.body;
    const currentUserId = req.user._id;
    const { employeeId } = req.body;

    const targetUser = await User.findById(employeeId);
    if (targetUser?.status === "pending") {
      return res.status(400).json({ success: false, message: "Người dùng chưa hoàn tất đăng ký." });
    }

    // Kiểm tra user hiện tại có phải là chủ shop không
    const ownerRole = await Role.findOne({ role_name: "Shop Owner" });
    const marketingRole = await Role.findOne({ role_name: "Marketing Admin" });

    if (!ownerRole || !marketingRole)
      return res.status(400).json({ message: "Role dữ liệu chưa được khởi tạo đầy đủ" });

    const currentOwnerRole = await UserRole.findOne({
      user_id: currentUserId,
      shop_id: shopId,
      role_id: ownerRole._id,
    });
    console.log("currentOwnerRole:", currentOwnerRole);

    if (!currentOwnerRole)
      return res.status(403).json({ message: "Bạn không có quyền thực hiện thao tác này." });

    // Kiểm tra nhân viên có thuộc shop không
    const employeeRole = await UserRole.findOne({
      user_id: employeeId,
      shop_id: shopId,
    });

    if (!employeeRole)
      return res.status(404).json({ message: "Nhân viên không thuộc cửa hàng này." });

    // Cập nhật role: chuyển quyền
    await Promise.all([
      // Shop Owner cũ → Marketing Admin
      UserRole.findOneAndUpdate(
        { user_id: currentUserId, shop_id: shopId },
        { role_id: marketingRole._id }
      ),
      // Employee → Shop Owner
      UserRole.findOneAndUpdate(
        { user_id: employeeId, shop_id: shopId },
        { role_id: ownerRole._id }
      ),
    ]);

    return res.status(200).json({ message: "Đã chuyển quyền Shop Owner thành công." });
  } catch (error) {
    console.error("Lỗi relinquishOwnership:", error);
    res.status(500).json({ message: "Lỗi hệ thống", error: error.message });
  }
};

// Delete ShopUser (xóa hẳn)
export const deleteShopUser = async (req, res) => {
  try {
    const shopUser = await ShopUser.findByIdAndDelete(req.params.id);
    if (!shopUser) return res.status(404).json({ message: "ShopUser not found" });
    res.json({ message: "ShopUser deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};