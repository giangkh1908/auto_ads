import Shop from "../models/shops/shop.model.js";
import UserPackage from "../models/userPackage.model.js";

/**
 * Đồng bộ package của tất cả shop thuộc owner với package hiện tại của owner
 * @param {string} ownerId - ID của shop owner
 * @returns {Promise<{updated: number, shops: Array}>}
 */
export const syncShopPackagesWithOwner = async (ownerId) => {
  try {
    if (!ownerId) {
      console.warn("⚠️ syncShopPackagesWithOwner: ownerId is required");
      return { updated: 0, shops: [] };
    }

    // Lấy package active hiện tại của owner
    const ownerPackage = await UserPackage.findOne({
      user_id: ownerId,
      status: { $in: ["active", "expiring soon", "new signup"] },
      deleted_at: null,
    })
      .populate("package_id")
      .sort({ created_at: -1 });

    if (!ownerPackage || !ownerPackage.package_id) {
      console.log(`ℹ️ Owner ${ownerId} không có package active, không cần sync shop packages`);
      return { updated: 0, shops: [] };
    }

    // Lấy tất cả shop của owner
    const shops = await Shop.find({
      owner_id: ownerId,
      deleted_at: null,
    });

    if (shops.length === 0) {
      return { updated: 0, shops: [] };
    }

    // Cập nhật package cho tất cả shop
    const updateResult = await Shop.updateMany(
      {
        owner_id: ownerId,
        deleted_at: null,
      },
      {
        $set: {
          current_package_id: ownerPackage.package_id._id,
          package_expired_at: ownerPackage.to_date || null,
          updated_at: new Date(),
        },
      }
    );

    console.log(
      `✅ Đã sync package cho ${updateResult.modifiedCount} shop của owner ${ownerId}. Package: ${ownerPackage.package_id.name}`
    );

    return {
      updated: updateResult.modifiedCount,
      shops: shops.map((s) => s._id.toString()),
      package: {
        id: ownerPackage.package_id._id,
        name: ownerPackage.package_id.name,
        expired_at: ownerPackage.to_date,
      },
    };
  } catch (error) {
    console.error("❌ Lỗi sync shop packages với owner package:", error);
    throw error;
  }
};

/**
 * Đồng bộ package cho một shop cụ thể với package của owner hiện tại
 * @param {string} shopId - ID của shop
 * @returns {Promise<Object>}
 */
export const syncSingleShopPackage = async (shopId) => {
  try {
    const shop = await Shop.findById(shopId).populate("owner_id");
    if (!shop || !shop.owner_id) {
      throw new Error(`Shop ${shopId} không tồn tại hoặc không có owner`);
    }

    const ownerId = shop.owner_id._id || shop.owner_id;

    // Lấy package active hiện tại của owner
    const ownerPackage = await UserPackage.findOne({
      user_id: ownerId,
      status: { $in: ["active", "expiring soon", "new signup"] },
      deleted_at: null,
    })
      .populate("package_id")
      .sort({ created_at: -1 });

    if (!ownerPackage || !ownerPackage.package_id) {
      console.log(`ℹ️ Owner ${ownerId} không có package active, không cần sync shop ${shopId}`);
      return { updated: 0, shop: shopId };
    }

    // Cập nhật package cho shop cụ thể
    const updatedShop = await Shop.findByIdAndUpdate(
      shopId,
      {
        $set: {
          current_package_id: ownerPackage.package_id._id,
          package_expired_at: ownerPackage.to_date || null,
          updated_at: new Date(),
        },
      },
      { new: true }
    );

    console.log(
      `✅ Đã sync package cho shop ${shopId}. Package: ${ownerPackage.package_id.name}`
    );

    return {
      updated: updatedShop ? 1 : 0,
      shop: shopId,
      package: {
        id: ownerPackage.package_id._id,
        name: ownerPackage.package_id.name,
        expired_at: ownerPackage.to_date,
      },
    };
  } catch (error) {
    console.error(`❌ Lỗi sync package cho shop ${shopId}:`, error);
    throw error;
  }
};

