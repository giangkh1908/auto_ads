import AutomationRule from "../../models/auto/autoRule.model.js";
import AdsAccount from "../../models/ads/adsAccount.model.js";
import UserRole from "../../models/user/userRole.model.js";
import Shop from "../../models/shops/shop.model.js";
import mongoose from "mongoose";
import { calculateNextRunAt } from "../../services/auto/autoRuleService.js";

/**
 * GET /api/automation-rules
 * Lấy danh sách automation rules
 */
export const getAutomationRules = async (req, res) => {
  try {
    const { account_id, shop_id, page = 1, limit = 10, fetch_all = false } = req.query;
    const userId = req.user?._id;

    // Build filter
    const filter = {
      deleted_at: null, // Không lấy rules đã bị xóa
    };

    // Filter theo account (external_account_id)
    if (account_id) {
      const normalizedId = account_id.startsWith("act_")
        ? account_id.substring(4)
        : account_id;
      filter.external_account_id = {
        $in: [normalizedId, `act_${normalizedId}`],
      };
    }

    // Filter theo shop_id (ưu tiên shop_id từ query, nếu không có thì lấy từ user)
    let shopIdToFilter = shop_id;
    if (!shopIdToFilter && userId) {
      // Ưu tiên 1: Lấy shop_id từ UserRole với is_current = true (shop đang active)
      const currentUserRole = await UserRole.findOne({
        user_id: userId,
        is_current: true,
        shop_id: { $ne: null },
        revoked_at: null,
      }).lean();

      if (currentUserRole?.shop_id) {
        shopIdToFilter = currentUserRole.shop_id.toString();
      } else {
        // Fallback: Tìm shop mà user là owner
        const shop = await Shop.findOne({
          owner_id: userId,
          deleted_at: null,
        }).lean();
        
        if (shop) {
          shopIdToFilter = shop._id.toString();
        }
      }
    }

    // Thêm filter shop_id nếu có
    if (shopIdToFilter) {
      filter.shop_id = new mongoose.Types.ObjectId(shopIdToFilter);
    }

    // Filter theo user (chỉ lấy rules của user hiện tại)
    if (userId) {
      filter.$or = [
        { created_by: new mongoose.Types.ObjectId(userId) },
        { subscriber_id: new mongoose.Types.ObjectId(userId) },
      ];
    }

    // Pagination
    const limitNum = Number(limit);
    const shouldFetchAll =
      fetch_all === "true" || fetch_all === true || limitNum === 0 || limitNum > 10000;

    let items, total;

    if (shouldFetchAll) {
      [items, total] = await Promise.all([
        AutomationRule.find(filter)
          .populate("account_id", "external_id name")
          .populate("created_by", "full_name email")
          .populate("subscriber_id", "full_name email")
          .sort({ created_at: -1 }),
        AutomationRule.countDocuments(filter),
      ]);
    } else {
      const pageNum = Number(page);
      const skip = (pageNum - 1) * limitNum;

      [items, total] = await Promise.all([
        AutomationRule.find(filter)
          .populate("account_id", "external_id name")
          .populate("created_by", "full_name email")
          .populate("subscriber_id", "full_name email")
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(limitNum),
        AutomationRule.countDocuments(filter),
      ]);
    }

    return res.status(200).json({
      success: true,
      items,
      total,
      page: shouldFetchAll ? 1 : Number(page),
      limit: shouldFetchAll ? total : limitNum,
      totalPages: shouldFetchAll ? 1 : Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error("Get automation rules error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách quy tắc tự động",
      error: error.message,
    });
  }
};

/**
 * GET /api/automation-rules/:id
 * Lấy chi tiết automation rule
 */
export const getAutomationRuleById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID không hợp lệ",
      });
    }

    const rule = await AutomationRule.findOne({
      _id: id,
      deleted_at: null,
    })
      .populate("account_id", "external_id name")
      .populate("created_by", "full_name email")
      .populate("subscriber_id", "full_name email");

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy quy tắc",
      });
    }

    // Kiểm tra quyền truy cập (chỉ creator hoặc subscriber mới xem được)
    if (
      userId &&
      rule.created_by._id.toString() !== userId.toString() &&
      rule.subscriber_id._id.toString() !== userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền truy cập quy tắc này",
      });
    }

    return res.status(200).json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.error("Get automation rule by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy chi tiết quy tắc",
      error: error.message,
    });
  }
};

/**
 * POST /api/automation-rules
 * Tạo automation rule mới
 */
export const createAutomationRule = async (req, res) => {
  try {
    const {
      name,
      account_id,
      shop_id,
      apply_to,
      apply_to_ids,
      action,
      conditions,
      schedule,
      notification,
    } = req.body;

    const userId = req.user?._id;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Tên quy tắc là bắt buộc",
      });
    }

    if (!account_id) {
      return res.status(400).json({
        success: false,
        message: "Account ID là bắt buộc",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(account_id)) {
      return res.status(400).json({
        success: false,
        message: "Account ID không hợp lệ",
      });
    }

    // Kiểm tra account tồn tại
    const account = await AdsAccount.findById(account_id);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản quảng cáo",
      });
    }

    if (!action) {
      return res.status(400).json({
        success: false,
        message: "Hành động là bắt buộc",
      });
    }

    // conditions KHÔNG còn bắt buộc
    // Nếu truyền lên thì phải là mảng, có thể rỗng (rule chạy thuần theo lịch)
    if (conditions !== undefined && !Array.isArray(conditions)) {
      return res.status(400).json({
        success: false,
        message: "Trường conditions phải là một mảng",
      });
    }

    if (!schedule || !schedule.type) {
      return res.status(400).json({
        success: false,
        message: "Lịch trình là bắt buộc",
      });
    }

    // Validate apply_to_ids
    const { campaign_ids = [], adset_ids = [], ad_ids = [] } =
      apply_to_ids || {};
    if (
      campaign_ids.length === 0 &&
      adset_ids.length === 0 &&
      ad_ids.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn ít nhất một chiến dịch, adset hoặc ad",
      });
    }

    // Validate và convert IDs
    const validatedCampaignIds = campaign_ids
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const validatedAdsetIds = adset_ids
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const validatedAdIds = ad_ids
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (
      validatedCampaignIds.length === 0 &&
      validatedAdsetIds.length === 0 &&
      validatedAdIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Không có ID hợp lệ nào được chọn",
      });
    }

    // Tính next_run_at dựa trên schedule sử dụng service
    const next_run_at = calculateNextRunAt(schedule);

    // Tạo rule mới
    const newRule = await AutomationRule.create({
      name: name.trim(),
      account_id: new mongoose.Types.ObjectId(account_id),
      external_account_id: account.external_id, // Sẽ được set tự động bởi pre-save hook, nhưng set sẵn để đảm bảo
      shop_id: shop_id
        ? new mongoose.Types.ObjectId(shop_id)
        : null,
      apply_to: apply_to || "",
      apply_to_ids: {
        campaign_ids: validatedCampaignIds,
        adset_ids: validatedAdsetIds,
        ad_ids: validatedAdIds,
      },
      action,
      conditions,
      schedule,
      notification: notification !== undefined ? notification : true,
      created_by: new mongoose.Types.ObjectId(userId),
      subscriber_id: new mongoose.Types.ObjectId(userId),
      enabled: true,
      status: "ACTIVE",
      next_run_at,
    });

    // Populate để trả về đầy đủ thông tin
    const populatedRule = await AutomationRule.findById(newRule._id)
      .populate("account_id", "external_id name")
      .populate("created_by", "full_name email")
      .populate("subscriber_id", "full_name email");

    return res.status(201).json({
      success: true,
      message: "Tạo quy tắc thành công",
      data: populatedRule,
    });
  } catch (error) {
    console.error("Create automation rule error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi tạo quy tắc",
      error: error.message,
    });
  }
};

/**
 * PUT /api/automation-rules/:id
 * Cập nhật automation rule
 */
export const updateAutomationRule = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      account_id,
      shop_id,
      apply_to,
      apply_to_ids,
      action,
      conditions,
      schedule,
      notification,
      enabled,
      status,
    } = req.body;

    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID không hợp lệ",
      });
    }

    // Tìm rule hiện tại
    const existingRule = await AutomationRule.findOne({
      _id: id,
      deleted_at: null,
    });

    if (!existingRule) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy quy tắc",
      });
    }

    // Kiểm tra quyền (chỉ creator mới được update)
    if (userId && existingRule.created_by.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền cập nhật quy tắc này",
      });
    }

    // Validation
    if (name !== undefined && (!name || !name.trim())) {
      return res.status(400).json({
        success: false,
        message: "Tên quy tắc không được để trống",
      });
    }

    // Nếu account_id thay đổi, validate account mới
    let external_account_id = existingRule.external_account_id;
    if (account_id && account_id !== existingRule.account_id.toString()) {
      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        return res.status(400).json({
          success: false,
          message: "Account ID không hợp lệ",
        });
      }

      const account = await AdsAccount.findById(account_id);
      if (!account) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy tài khoản quảng cáo",
        });
      }
      external_account_id = account.external_id;
    }

    // Validate conditions nếu có
    // Cho phép mảng rỗng để hỗ trợ rule chỉ chạy theo lịch
    if (conditions !== undefined && !Array.isArray(conditions)) {
      return res.status(400).json({
        success: false,
        message: "Trường conditions phải là một mảng",
      });
    }

    // Validate apply_to_ids nếu có
    if (apply_to_ids !== undefined) {
      const { campaign_ids = [], adset_ids = [], ad_ids = [] } = apply_to_ids;
      if (
        campaign_ids.length === 0 &&
        adset_ids.length === 0 &&
        ad_ids.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng chọn ít nhất một chiến dịch, adset hoặc ad",
        });
      }

      // Validate và convert IDs
      apply_to_ids.campaign_ids = campaign_ids
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      apply_to_ids.adset_ids = adset_ids
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      apply_to_ids.ad_ids = ad_ids
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
    }

    // Tính next_run_at nếu schedule thay đổi
    let next_run_at = existingRule.next_run_at;
    if (schedule && schedule.type) {
      next_run_at = calculateNextRunAt(schedule);
    }

    // Update rule
    const updateData = {
      updated_by: new mongoose.Types.ObjectId(userId),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (account_id !== undefined) {
      updateData.account_id = new mongoose.Types.ObjectId(account_id);
      updateData.external_account_id = external_account_id;
    }
    if (shop_id !== undefined)
      updateData.shop_id = shop_id
        ? new mongoose.Types.ObjectId(shop_id)
        : null;
    if (apply_to !== undefined) updateData.apply_to = apply_to;
    if (apply_to_ids !== undefined) updateData.apply_to_ids = apply_to_ids;
    if (action !== undefined) updateData.action = action;
    if (conditions !== undefined) updateData.conditions = conditions;
    if (schedule !== undefined) {
      updateData.schedule = schedule;
      updateData.next_run_at = next_run_at;
    }
    if (notification !== undefined) updateData.notification = notification;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (status !== undefined) updateData.status = status;

    const updatedRule = await AutomationRule.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("account_id", "external_id name")
      .populate("created_by", "full_name email")
      .populate("subscriber_id", "full_name email");

    return res.status(200).json({
      success: true,
      message: "Cập nhật quy tắc thành công",
      data: updatedRule,
    });
  } catch (error) {
    console.error("Update automation rule error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật quy tắc",
      error: error.message,
    });
  }
};

/**
 * DELETE /api/automation-rules/:id
 * Xóa automation rule (soft delete)
 */
export const deleteAutomationRule = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID không hợp lệ",
      });
    }

    const rule = await AutomationRule.findOne({
      _id: id,
      deleted_at: null,
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy quy tắc",
      });
    }

    // Kiểm tra quyền (chỉ creator mới được xóa)
    if (userId && rule.created_by.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xóa quy tắc này",
      });
    }

    // Soft delete
    rule.deleted_at = new Date();
    rule.status = "DELETED";
    rule.enabled = false;
    await rule.save();

    return res.status(200).json({
      success: true,
      message: "Xóa quy tắc thành công",
    });
  } catch (error) {
    console.error("Delete automation rule error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi xóa quy tắc",
      error: error.message,
    });
  }
};

/**
 * PATCH /api/automation-rules/:id/toggle
 * Bật/tắt automation rule
 */
export const toggleAutomationRule = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID không hợp lệ",
      });
    }

    const rule = await AutomationRule.findOne({
      _id: id,
      deleted_at: null,
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy quy tắc",
      });
    }

    // Kiểm tra quyền (chỉ creator hoặc subscriber mới được toggle)
    if (
      userId &&
      rule.created_by.toString() !== userId.toString() &&
      rule.subscriber_id.toString() !== userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền thay đổi trạng thái quy tắc này",
      });
    }

    // Toggle enabled và status
    rule.enabled = !rule.enabled;
    // Nếu đang bật và rule đã từng được triggered (trigger_count > 0), giữ status TRIGGERED
    // Nếu đang bật và rule chưa từng được triggered, set ACTIVE
    // Nếu đang tắt, set PAUSED
    if (rule.enabled) {
      // Nếu rule đã từng được triggered (trigger_count > 0 và last_triggered_at tồn tại)
      // và status hiện tại là TRIGGERED, giữ nguyên status TRIGGERED
      // Nếu không, set ACTIVE (rule sẽ được set TRIGGERED khi action được thực thi)
      if (rule.status === "TRIGGERED" && rule.trigger_count && rule.trigger_count > 0) {
        // Giữ nguyên status TRIGGERED
        rule.status = "TRIGGERED";
      } else {
        // Set ACTIVE (sẽ được chuyển sang TRIGGERED khi action được thực thi)
        rule.status = "ACTIVE";
      }
    } else {
      rule.status = "PAUSED";
    }
    rule.updated_by = new mongoose.Types.ObjectId(userId);
    await rule.save();

    const populatedRule = await AutomationRule.findById(rule._id)
      .populate("account_id", "external_id name")
      .populate("created_by", "full_name email")
      .populate("subscriber_id", "full_name email");

    return res.status(200).json({
      success: true,
      message: rule.enabled
        ? "Đã bật quy tắc"
        : "Đã tắt quy tắc",
      data: populatedRule,
    });
  } catch (error) {
    console.error("Toggle automation rule error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi thay đổi trạng thái quy tắc",
      error: error.message,
    });
  }
};

