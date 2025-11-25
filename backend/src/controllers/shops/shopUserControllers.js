import ShopUser from "../../models/shops/shopUser.model.js";
import UserRole from "../../models/userRole.model.js";
import User from "../../models/user.model.js";
import Role from "../../models/role.model.js";
import Shop from "../../models/shops/shop.model.js";
import { sendInvitationEmail } from "../../services/emailService.js";
import mongoose from "mongoose";
import { ErrorCode, getErrorMessage } from "../../constants/errorCode.js";
import { SuccessCode, getSuccessMessage } from "../../constants/successCode.js";
import { StatusEnum } from "../../constants/enum.js";
import { saveLog } from "../../utils/log.js";
import UserPackage from "../../models/userPackage.model.js";
import { getUserEntitlements } from "../../services/entitlementService.js";

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
    const { email, roleId, invitedBy } = req.body;
    const { shopId } = req.body;
    const shop = await Shop.findById(shopId);
    const currentUser = await User.findById(invitedBy);
    const role = await Role.findById(roleId);

    if (!email || !roleId || !invitedBy || !shopId) {
      return res.status(400).json({
        success: false,
        error: {
          code: ErrorCode.COMMON_003,
          message: getErrorMessage(ErrorCode.COMMON_003, 'vi'),
        },
      });
    }

    if (!shop) {
      return res.status(404).json({
        success: false,
        error: {
          code: ErrorCode.SHOP_001,
          message: getErrorMessage(ErrorCode.SHOP_001, 'vi'),
        },
      });
    }

    // Lấy shop owner để kiểm tra package limit
    const shopOwnerId = shop.owner_id;
    if (!shopOwnerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: ErrorCode.SHOP_001,
          message: getErrorMessage(ErrorCode.SHOP_001, 'vi'),
        },
      });
    }

    // Kiểm tra employee limit của shop owner - đếm riêng cho shop này (bao gồm cả owner)
    try {
      const ownerEntitlements = await getUserEntitlements(shopOwnerId.toString());
      const employeeLimit = ownerEntitlements?.limits?.employees || 1;
      
      // Đếm số employee hiện tại trong shop này (bao gồm cả owner)
      const shopUserCount = await ShopUser.countDocuments({
        shop_id: shopId,
        status: "active",
      });
      
      // Kiểm tra xem owner có trong ShopUser chưa, nếu chưa thì +1
      const ownerInShopUser = await ShopUser.findOne({
        shop_id: shopId,
        user_id: shopOwnerId,
        status: "active",
      });
      
      const currentEmployeeCount = ownerInShopUser ? shopUserCount : shopUserCount + 1;

      // Kiểm tra nếu đã đạt giới hạn
      if (currentEmployeeCount >= employeeLimit) {
        return res.status(403).json({
          success: false,
          error: {
            code: ErrorCode.EMP_008,
            message: getErrorMessage(ErrorCode.EMP_008, 'vi'),
          },
        });
      }
    } catch (entitlementError) {
      console.error("Error checking employee limit:", entitlementError);
      // Nếu không thể kiểm tra, vẫn cho phép thêm (fallback)
      // Hoặc có thể return error tùy theo yêu cầu
    }

    // Kiểm tra user tồn tại chưa
    let user = await User.findOne({ email });

    if (!user) {
      // Gửi email mời
      await sendInvitationEmail(email);
      // Note: Không cần update UserPackage.employees ở đây vì đã được tính trong countUsage

      await saveLog({
        user_id: invitedBy,
        user_name: currentUser.full_name || currentUser.email,
        shop_id: shopId,
        shop_name: shop.shop_name,
        action: "ADD_EMPLOYEE",
        target_type: "User",
        target_id: user._id.toString(),
        target_name: user.full_name || user.email,
        description: `${currentUser.full_name || currentUser.email} đã thêm nhân viên "${user.full_name || user.email}" (vai trò: ${role.role_name}) vào cửa hàng "${shop.shop_name}"`,
        request: req.body,
        response: shopUser,
        success: true,
        source: "manual",
        ip_address: req.ip,
        meta: { role_assigned: roleId, invited_email: email },
      });

      return res.status(200).json({
        success: true,
        code: SuccessCode.EMP_SUCCESS_001,
        message: getSuccessMessage(SuccessCode.EMP_SUCCESS_001, 'vi'),
        invitedEmail: email,
      });
    }

    // Nếu user đã tồn tại → thêm trực tiếp vào Shop
    if (user.status === StatusEnum.PENDING) {
      return res.status(400).json({
        success: false,
        error: {
          code: ErrorCode.AUTH_007,
          message: getErrorMessage(ErrorCode.AUTH_007, 'vi'),
        },
      });
    }

    // Tạo ShopUser
    const shopUser = await ShopUser.create({
      shop_id: shopId,
      user_id: user._id,
      invited_by: invitedBy,
      status: StatusEnum.ACTIVE,
    });

    // Tạo UserRole
    await UserRole.create({
      user_id: user._id,
      shop_id: shopId,
      role_id: roleId,
    });

    await saveLog({
      user_id: invitedBy,
      user_name: currentUser.full_name || currentUser.email,
      shop_id: shopId,
      shop_name: shop.shop_name,
      action: "ADD_EMPLOYEE",
      target_type: "User",
      target_id: user._id.toString(),
      target_name: user.full_name || user.email,
      description: `${currentUser.full_name || currentUser.email} đã thêm nhân viên "${user.full_name || user.email}" (vai trò: ${role.role_name}) vào cửa hàng "${shop.shop_name}"`,
      request: req.body,
      response: shopUser,
      success: true,
      source: "manual",
      ip_address: req.ip,
      meta: { role_assigned: roleId, invited_email: email },
    });

    return res.status(201).json({
      success: true,
      code: SuccessCode.EMP_SUCCESS_002,
      message: getSuccessMessage(SuccessCode.EMP_SUCCESS_002, 'vi'),
      data: shopUser,
    });
  } catch (error) {
    console.error("inviteEmployee error:", error);
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.COMMON_999,
        message: getErrorMessage(ErrorCode.COMMON_999, 'vi'),
      },
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

    // Lấy danh sách ShopUser thuộc shop này
    const shopUsers = await ShopUser.find({ shop_id: shopId })
      .populate({
        path: "user_id",
        select: "full_name username email avatar status",
        match: { status: { $ne: "pending" } } // Không lấy user pending
      })
      .lean();

    // Lấy danh sách userId để query sang UserRole
    const userIds = shopUsers.map(su => su.user_id?._id).filter(Boolean);

    // Lấy role tương ứng của từng user trong shop này
    const userRoles = await UserRole.find({
      user_id: { $in: userIds },
      shop_id: shopId
    })
      .populate("role_id", "role_name")
      .lean();

    // Map dữ liệu lại thành danh sách hoàn chỉnh
    const result = shopUsers.map(su => {
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

    res.status(200).json({
      success: true,
      code: SuccessCode.SUCCESS_000,
      message: getSuccessMessage(SuccessCode.SUCCESS_000, 'vi'),
      count: result.length,
      data: result
    });

  } catch (error) {
    console.error("getUsersByShop error:", error);
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.COMMON_999,
        message: getErrorMessage(ErrorCode.COMMON_999, 'vi'),
      },
    });
  }
};

// Lấy ShopUser theo ID
export const getShopUserById = async (req, res) => {
  try {
    const shopUser = await ShopUser.findById(req.params.id)
      .populate("shop_id", "shop_name")
      .populate("user_id", "name email");
    if (!shopUser)
      return res.status(404).json({
        code: ErrorCode.EMP_001,
        message: getErrorMessage(ErrorCode.EMP_001, 'vi')
      });
    res.json(shopUser);
  } catch (error) {
    res.status(500).json({
      code: ErrorCode.COMMON_999,
      message: getErrorMessage(ErrorCode.COMMON_999, 'vi')
    });
  }
};

// Lấy tất cả shop mà user đang tham gia
export const getShopsByUser = async (req, res) => {
  try {
    const userId = req.params.userId; // hoặc req.user._id nếu đang login

    const memberships = await ShopUser.find({
      user_id: userId,
      status: StatusEnum.ACTIVE,
    })
      .populate("shop_id", "shop_name industry status") // populate sang Shop
      .populate("invited_by", "name email"); // optional

    // Lọc ra chỉ phần shop cho gọn
    const shops = memberships.map(m => m.shop_id);

    res.status(200).json({ success: true, count: shops.length, data: shops });
  } catch (error) {
    console.error("getShopsByUser error:", error);
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.COMMON_999,
        message: getErrorMessage(ErrorCode.COMMON_999, 'vi')
      }
    });
  }
};

// Update ShopUser
export const updateShopUser = async (req, res) => {
  try {
    const shopUser = await ShopUser.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!shopUser) return res.status(404).json({
      code: ErrorCode.EMP_001,
      message: getErrorMessage(ErrorCode.EMP_001, 'vi')
    });
    res.json(shopUser);
  } catch (error) {
    res.status(500).json({
      code: ErrorCode.COMMON_999,
      message: getErrorMessage(ErrorCode.COMMON_999, 'vi')
    });
  }
};

//Update user's role
export const updateUserRole = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { userId, newRoleId, currentUserId } = req.body;
    const currentUser = await User.findById(currentUserId);
    const shop = await Shop.findById(shopId);

    const targetUser = await User.findById(userId);
    if (targetUser?.status === StatusEnum.PENDING) {
      return res.status(400).json({
        success: false,
        error: {
          code: ErrorCode.AUTH_007,
          message: getErrorMessage(ErrorCode.AUTH_007, 'vi'),
        },
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
        error: {
          code: ErrorCode.SHOP_001,
          message: getErrorMessage(ErrorCode.SHOP_001, 'vi'),
        },
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
        error: {
          code: ErrorCode.SHOP_001,
          message: getErrorMessage(ErrorCode.SHOP_001, 'vi'),
        },
      });
    }

    const targetRoleName = targetRole.role_id.role_name;

    // Lấy thông tin role mới
    const newRole = await Role.findById(newRoleId);
    if (!newRole) {
      return res.status(404).json({
        success: false,
        error: {
          code: ErrorCode.ROLE_001,
          message: getErrorMessage(ErrorCode.ROLE_001, 'vi'),
        },
      });
    }

    // Không được gán quyền Shop Owner cho người khác
    if (newRole.role_name === "Shop Owner") {
      return res.status(403).json({
        success: false,
        error: {
          code: ErrorCode.ROLE_006,
          message: getErrorMessage(ErrorCode.ROLE_006, 'vi'),
        },
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
        error: {
          code: ErrorCode.ROLE_006,
          message: getErrorMessage(ErrorCode.ROLE_006, 'vi'),
        },
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
        error: {
          code: ErrorCode.COMMON_003,
          message: getErrorMessage(ErrorCode.COMMON_003, 'vi'),
        },
      });
    }

    await saveLog({
      user_id: currentUserId,
      user_name: currentUser.full_name || currentUser.email,
      shop_id: shopId,
      shop_name: shop.shop_name,
      action: "UPDATE_USER_ROLE",
      target_type: "UserRole",
      target_id: userId,
      target_name: targetUser.full_name || targetUser.email,
      description: `${currentUser.full_name || currentUser.email} đã thay đổi vai trò của "${targetUser.full_name || targetUser.email}" từ "${targetRoleName}" → "${newRole.role_name}" trong cửa hàng "${shop.shop_name}"`,
      request: req.body,
      response: updated,
      success: true,
      source: "manual",
      ip_address: req.ip,
      meta: {
        old_role: targetRoleName,
        new_role: updated.role_id?.role_name,
      },
    });

    res.status(200).json({
      success: true,
      code: SuccessCode.ROLE_SUCCESS_002,
      message: getSuccessMessage(SuccessCode.ROLE_SUCCESS_002, 'vi'),
      data: updated,
    });
  } catch (error) {
    console.error("updateUserRole error:", error);
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.COMMON_999,
        message: getErrorMessage(ErrorCode.COMMON_999, 'vi'),
      },
    });
  }
};

// Cập nhật trạng thái hoạt động của user trong shop (active / inactive / removed)
export const updateUserStatus = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { userId, newStatus, currentUserId } = req.body;
    const currentUser = await User.findById(currentUserId);
    const shop = await Shop.findById(shopId);

    const targetUser = await User.findById(userId);
    if (targetUser?.status === StatusEnum.PENDING) {
      return res.status(400).json({
        success: false,
        error: {
          code: ErrorCode.AUTH_007,
          message: getErrorMessage(ErrorCode.AUTH_007, 'vi'),
        },
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
        error: {
          code: ErrorCode.SHOP_001,
          message: getErrorMessage(ErrorCode.SHOP_001, 'vi'),
        },
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
        error: {
          code: ErrorCode.ROLE_001,
          message: getErrorMessage(ErrorCode.ROLE_001, 'vi'),
        },
      });
    }

    const targetRoleName = targetRole.role_id.role_name;

    // Không cho tự đổi trạng thái chính mình
    if (userId === currentUserId) {
      return res.status(400).json({
        success: false,
        error: {
          code: ErrorCode.AUTH_008,
          message: getErrorMessage(ErrorCode.AUTH_008, 'vi'),
        },
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
        error: {
          code: ErrorCode.ROLE_006,
          message: getErrorMessage(ErrorCode.ROLE_006, 'vi'),
        },
      });
    }

    // Kiểm tra trạng thái hợp lệ
    const allowedStatuses = [StatusEnum.ACTIVE, StatusEnum.INACTIVE, StatusEnum.REMOVED];
    if (!allowedStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        error: {
          code: ErrorCode.COMMON_003,
          message: getErrorMessage(ErrorCode.COMMON_003, 'vi'),
        },
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
        error: {
          code: ErrorCode.EMP_001,
          message: getErrorMessage(ErrorCode.EMP_001, 'vi'),
        },
      });
    }
    console.log("newStatus", newStatus);

    // Xác định action và description dựa trên status
    let logAction = "UPDATE_USER_STATUS";
    let logDescription = `${currentUser.full_name || currentUser.email} đã ${newStatus} nhân viên "${targetUser.full_name || targetUser.email}" trong cửa hàng "${shop.shop_name}"`;
    
    if (newStatus === StatusEnum.REMOVED) {
      logAction = "REMOVE_EMPLOYEE";
      logDescription = `${currentUser.full_name || currentUser.email} đã xóa nhân viên "${targetUser.full_name || targetUser.email}" ra khỏi cửa hàng "${shop.shop_name}"`;
    }

    await saveLog({
      user_id: currentUserId,
      user_name: currentUser.full_name || currentUser.email,
      shop_id: shopId,
      shop_name: shop.shop_name,
      action: logAction,
      target_type: "ShopUser",
      target_id: userId,
      target_name: targetUser.full_name || targetUser.email,
      description: logDescription,
      request: req.body,
      response: updated,
      success: true,
      source: "manual",
      ip_address: req.ip,
    });

    res.status(200).json({
      success: true,
      code: SuccessCode.EMP_SUCCESS_003,
      message: getSuccessMessage(SuccessCode.EMP_SUCCESS_003, 'vi'),
      data: updated,
    });
  } catch (error) {
    console.error("updateUserStatus error:", error);
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.COMMON_999,
        message: getErrorMessage(ErrorCode.COMMON_999, 'vi'),
      },
    });
  }
};

// Remove employee hoàn toàn khỏi shop
export const removeEmployee = async (req, res) => {
  try {
    const { shopId, userId } = req.params;
    const { currentUserId } = req.body;
    
    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        error: {
          code: ErrorCode.AUTH_001,
          message: getErrorMessage(ErrorCode.AUTH_001, 'vi'),
        },
      });
    }

    const currentUser = await User.findById(currentUserId);
    const shop = await Shop.findById(shopId);

    if (!shop || !currentUser) {
      return res.status(404).json({
        success: false,
        error: {
          code: ErrorCode.COMMON_001,
          message: getErrorMessage(ErrorCode.COMMON_001, 'vi'),
        },
      });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: {
          code: ErrorCode.EMP_001,
          message: getErrorMessage(ErrorCode.EMP_001, 'vi'),
        },
      });
    }

    // Lấy role của người đang thao tác
    const actorRole = await UserRole.findOne({
      shop_id: shopId,
      user_id: currentUserId,
    }).populate("role_id", "role_name");

    if (!actorRole) {
      return res.status(403).json({
        success: false,
        error: {
          code: ErrorCode.SHOP_001,
          message: getErrorMessage(ErrorCode.SHOP_001, 'vi'),
        },
      });
    }

    const actorRoleName = actorRole.role_id.role_name;

    // Lấy ShopUser và UserRole của employee bị remove
    const shopUser = await ShopUser.findOne({
      shop_id: shopId,
      user_id: userId,
    });

    if (!shopUser) {
      return res.status(404).json({
        success: false,
        error: {
          code: ErrorCode.EMP_001,
          message: getErrorMessage(ErrorCode.EMP_001, 'vi'),
        },
      });
    }

    const targetRole = await UserRole.findOne({
      shop_id: shopId,
      user_id: userId,
    }).populate("role_id", "role_name");

    if (!targetRole) {
      return res.status(404).json({
        success: false,
        error: {
          code: ErrorCode.ROLE_001,
          message: getErrorMessage(ErrorCode.ROLE_001, 'vi'),
        },
      });
    }

    const targetRoleName = targetRole.role_id.role_name;

    // Kiểm tra quyền hạn
    // Shop Owner: có thể xóa Marketing Admin và Marketer
    // Marketing Admin: có thể xóa Marketing Admin và Marketer (nhưng không thể xóa Shop Owner)
    const canRemove =
      (actorRoleName === "Shop Owner" &&
        ["Marketing Admin", "Marketer"].includes(targetRoleName)) ||
      (actorRoleName === "Marketing Admin" &&
        ["Marketing Admin", "Marketer"].includes(targetRoleName));

    if (!canRemove) {
      return res.status(403).json({
        success: false,
        error: {
          code: ErrorCode.ROLE_006,
          message: getErrorMessage(ErrorCode.ROLE_006, 'vi'),
        },
      });
    }

    // Không cho tự xóa chính mình
    if (userId === currentUserId) {
      return res.status(400).json({
        success: false,
        error: {
          code: ErrorCode.AUTH_008,
          message: getErrorMessage(ErrorCode.AUTH_008, 'vi'),
        },
      });
    }

    // Xử lý is_current: Nếu employee đang set shop này là current shop,
    // cần chuyển sang shop khác hoặc bỏ is_current
    if (targetRole.is_current) {
      // Tìm shop khác của user (nếu có) và set làm current
      const otherUserRole = await UserRole.findOne({
        user_id: userId,
        shop_id: { $ne: shopId },
        revoked_at: null,
      });
      
      if (otherUserRole) {
        await UserRole.findByIdAndUpdate(otherUserRole._id, {
          is_current: true,
        });
      }
      // Nếu không có shop nào khác, đơn giản là bỏ is_current
      // (User sẽ phải chọn shop khác khi login lại)
    }

    // BƯỚC 1: Xóa UserRole trong shop này (hard delete)
    await UserRole.findByIdAndDelete(targetRole._id);

    // BƯỚC 2: Xóa ShopUser record
    await ShopUser.findByIdAndDelete(shopUser._id);

    // Log lại hành động
    await saveLog({
      user_id: currentUserId,
      user_name: currentUser.full_name || currentUser.email,
      shop_id: shopId,
      shop_name: shop.shop_name,
      action: "REMOVE_EMPLOYEE",
      target_type: "ShopUser",
      target_id: userId,
      target_name: targetUser.full_name || targetUser.email,
      description: `${currentUser.full_name || currentUser.email} đã xóa nhân viên "${targetUser.full_name || targetUser.email}" ra khỏi cửa hàng "${shop.shop_name}"`,
      request: req.body,
      response: { removed: true },
      success: true,
      source: "manual",
      ip_address: req.ip,
    });

    res.status(200).json({
      success: true,
      code: SuccessCode.EMP_SUCCESS_004,
      message: getSuccessMessage(SuccessCode.EMP_SUCCESS_004, 'vi'),
      data: {
        removed: true,
        userId: userId,
        shopId: shopId,
      },
    });
  } catch (error) {
    console.error("removeEmployee error:", error);
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.COMMON_999,
        message: getErrorMessage(ErrorCode.COMMON_999, 'vi'),
      },
    });
  }
};

export const relinquishOwnership = async (req, res) => {
  try {
    const { shopId } = req.body;
    const currentUserId = req.user._id;
    const { employeeId } = req.body;
    const shop = await Shop.findById(shopId);
    const currentUser = await User.findById(currentUserId);

    const targetUser = await User.findById(employeeId);
    if (targetUser?.status === StatusEnum.PENDING) {
      return res.status(400).json({
        success: false,
        error: {
          code: ErrorCode.AUTH_007,
          message: getErrorMessage(ErrorCode.AUTH_007, 'vi'),
        },
      });
    }

    // Kiểm tra user hiện tại có phải là chủ shop không
    const ownerRole = await Role.findOne({ role_name: "Shop Owner" });
    const marketingRole = await Role.findOne({ role_name: "Marketing Admin" });

    if (!ownerRole || !marketingRole)
      return res.status(400).json({
        success: false,
        error: {
          code: ErrorCode.ROLE_001,
          message: getErrorMessage(ErrorCode.ROLE_001, 'vi'),
        },
      });

    const currentOwnerRole = await UserRole.findOne({
      user_id: currentUserId,
      shop_id: shopId,
      role_id: ownerRole._id,
    });

    if (!currentOwnerRole)
      return res.status(403).json({
        success: false,
        error: {
          code: ErrorCode.ROLE_006,
          message: getErrorMessage(ErrorCode.ROLE_006, 'vi'),
        },
      });

    // Kiểm tra nhân viên có thuộc shop không
    const employeeRole = await UserRole.findOne({
      user_id: employeeId,
      shop_id: shopId,
    });

    if (!employeeRole)
      return res.status(404).json({
        success: false,
        error: {
          code: ErrorCode.EMP_001,
          message: getErrorMessage(ErrorCode.EMP_001, 'vi'),
        },
      });

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

    // Cập nhật owner_id trong Shop model
    await Shop.findByIdAndUpdate(
      shopId,
      {
        owner_id: employeeId,
        updated_by: currentUserId,
      },
      { new: true }
    );

    // Đồng bộ package của shop với package của owner mới
    try {
      const { syncSingleShopPackage } = await import("../../services/shopPackageSyncService.js");
      await syncSingleShopPackage(shopId);
      console.log(`✅ Đã sync package cho shop ${shopId} sau khi chuyển giao quyền owner`);
    } catch (syncError) {
      console.error("⚠️ Lỗi khi sync shop package sau khi chuyển giao quyền:", syncError);
      // Không throw error để không ảnh hưởng đến flow chính
    }

    await saveLog({
      user_id: currentUserId,
      user_name: currentUser.full_name || currentUser.email,
      shop_id: shopId,
      shop_name: shop.shop_name,
      action: "TRANSFER_OWNERSHIP",
      target_type: "User",
      target_id: employeeId,
      target_name: targetUser.full_name || targetUser.email,
      description: `${currentUser.full_name || currentUser.email} đã chuyển giao quyền chủ shop "${shop.shop_name}" cho "${targetUser.full_name || targetUser.email}"`,
      request: req.body,
      ip_address: req.ip,
      success: true,
      source: "manual",
      ip_address: req.ip,
      meta: {
        transferred_by: currentUserId.toString(),
        transferred_to: employeeId.toString(),
        timestamp: new Date(),
      },
    });

    return res.status(200).json({
      code: SuccessCode.ROLE_SUCCESS_002,
      message: getSuccessMessage(SuccessCode.ROLE_SUCCESS_002, 'vi'),
    });
  } catch (error) {
    console.error("Lỗi relinquishOwnership:", error);
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.COMMON_999,
        message: getErrorMessage(ErrorCode.COMMON_999, 'vi'),
      },
    });
  }
};

export const assignPagesToEmployee = async (req, res) => {
  try {
    const { shopId, employeeId, pages } = req.body;
    const currentUserId = req.user._id;
    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(employeeId);

    if (!shopId || !employeeId || !Array.isArray(pages)) {
      return res.status(400).json({
        success: false,
        error: {
          code: ErrorCode.COMMON_003,
          message: getErrorMessage(ErrorCode.COMMON_003, 'vi'),
        },
      });
    }

    const shopObjectId = new mongoose.Types.ObjectId(shopId);
    const employeeObjectId = new mongoose.Types.ObjectId(employeeId);

    // Kiểm tra ShopUser (employee & current user)
    const [employee] = await Promise.all([
      ShopUser.findOne({ user_id: employeeObjectId, shop_id: shopObjectId }),
      ShopUser.findOne({ user_id: currentUserId, shop_id: shopObjectId }),
    ]);

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: {
          code: ErrorCode.EMP_001,
          message: getErrorMessage(ErrorCode.EMP_001, 'vi'),
        },
      });
    }

    // Kiểm tra quyền người thực hiện (chỉ Owner hoặc Marketing Admin)
    const hasPermission = await UserRole.hasPermission(currentUserId, shopObjectId, "employee", "assign_page");
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: {
          code: ErrorCode.ROLE_006,
          message: getErrorMessage(ErrorCode.ROLE_006, 'vi'),
        },
      });
    }

    // Cập nhật facebook_pages cho ShopUser (employee)
    const normalizedPages = pages.map((p) => ({
      page_id: p.page_id,
      page_name: p.page_info?.name || "",
      page_category: p.page_info?.category || "",
      page_access_token: p.page_token,
      picture_url: p.page_info?.picture_url || "",
      connected_status: "connected",
      assigned_by: currentUserId,
      assigned_at: new Date(),
    }));

    // Merge: giữ page cũ không bị mất nếu không có trong danh sách mới
    const existingPages = employee.facebook_pages || [];

    // TẠO DANH SÁCH TÊN PAGE ĐỂ LƯU LOG
    const pageNames = normalizedPages
      .map(p => p.page_name)
      .filter(Boolean)
      .join(", ");
    const pageCount = normalizedPages.length;

    const mergedPages = [
      ...normalizedPages,
      ...existingPages.filter((old) => !normalizedPages.some((np) => np.page_id === old.page_id)),
    ];

    // Cập nhật employee bằng findOneAndUpdate (thay vì .save())
    const updatedEmployee = await ShopUser.findOneAndUpdate(
      { user_id: employeeObjectId, shop_id: shopObjectId },
      { $set: { facebook_pages: mergedPages } },
      { new: true }
    );

    // Cập nhật User.facebook_pages (và overwrite token nếu khác)
    const shop = await Shop.findOne(shopObjectId);
    if (shop) {
      const updatedPages = Array.isArray(shop.facebook_pages)
        ? [...shop.facebook_pages]
        : [];

      normalizedPages.forEach((p) => {
        const existingIndex = updatedPages.findIndex(
          (sp) => sp.page_id === p.page_id
        );

        if (existingIndex !== -1) {
          // Nếu đã tồn tại page → chỉ cập nhật token nếu khác
          if (updatedPages[existingIndex].page_token !== p.page_access_token) {
            updatedPages[existingIndex].page_token = p.page_access_token;
          }

          // Cập nhật lại thông tin page_info (nếu có thay đổi)
          updatedPages[existingIndex].page_info = {
            ...updatedPages[existingIndex].page_info,
            name: p.page_name || updatedPages[existingIndex].page_info?.name,
            category: p.page_category || updatedPages[existingIndex].page_info?.category,
            picture_url: p.picture_url || updatedPages[existingIndex].page_info?.picture_url,
          };

          updatedPages[existingIndex].connected_status = StatusEnum.CONNECTED;
          updatedPages[existingIndex].last_synced_at = new Date();
        } else {
          // Nếu chưa có → thêm mới
          updatedPages.push({
            page_id: p.page_id,
            page_token: p.page_access_token,
            page_info: {
              name: p.page_name,
              category: p.page_category,
              picture_url: p.picture_url,
              link: p.page_link || `https://www.facebook.com/${p.page_id}`,
            },
            connected_status: StatusEnum.CONNECTED,
            connected_at: new Date(),
            last_synced_at: new Date(),
          });
        }
      });
      shop.facebook_pages = updatedPages;

      shop.updated_by = currentUserId;

      await shop.save();
    }

    await saveLog({
      user_id: currentUserId,
      user_name: currentUser.full_name || currentUser.email,
      shop_id: shop._id,
      shop_name: shop.shop_name,
      action: "ASSIGN_PAGES",
      target_type: "FacebookPage",
      target_id: employeeId,
      target_name: targetUser.full_name || targetUser.email,
      description: `Phân quyền cho nhân viên ${targetUser.full_name || targetUser.email} vào các page: ${pageNames} (${pageCount} trang); Cửa hàng: ${shop.shop_name}`,
      request: req.body,
      response: updatedEmployee,
      ip_address: req.ip,
      success: true,
      source: "manual",
      ip_address: req.ip,
      meta: { assigned_pages: pages.map(p => p.page_id) },
    });

    return res.status(200).json({
      success: true,
      code: SuccessCode.SUCCESS_000,
      message: getSuccessMessage(SuccessCode.SUCCESS_000, 'vi'),
      data: updatedEmployee,
    });
  } catch (error) {
    console.error("Lỗi khi phân quyền Page:", error);
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.COMMON_999,
        message: getErrorMessage(ErrorCode.COMMON_999, 'vi'),
      },
    });
  }
};

// Delete ShopUser (xóa hẳn)
export const deleteShopUser = async (req, res) => {
  try {
    const shopUser = await ShopUser.findByIdAndDelete(req.params.id);
    if (!shopUser) return res.status(404).json({
      status: false,
      error: {
        code: ErrorCode.EMP_001,
        message: getErrorMessage(ErrorCode.EMP_001, 'vi'),
      },
    });
    // await saveLog({
    //   user_id: currentUserId,
    //   user_name: actorName,
    //   shop_id: shopUser.shop_id,
    //   shop_name: shopName,
    //   action: "REMOVE_EMPLOYEE",
    //   target_type: "ShopUser",
    //   target_id: shopUser.user_id?._id?.toString(),
    //   target_name: employeeName,
    //   description: `${actorName} đã xóa nhân viên "${employeeName}" ra khỏi cửa hàng "${shopName}"`,
    //   ip_address: req.ip,
    //   success: true,
    //   source: "manual",
    // });
    res.json({ message: "ShopUser deleted" });
  } catch (error) {
    res.status(500).json({
      status: false,
      error: {
        code: ErrorCode.COMMON_999,
        message: getErrorMessage(ErrorCode.COMMON_999, 'vi'),
      },
    });
  }
};