import Shop from "../../models/shops/shop.model.js";
import ShopUser from "../../models/shops/shopUser.model.js";
import UserRole from "../../models/user/userRole.model.js";
import Role from "../../models/admin/role.model.js";

async function getOrCreateShopOwnerRole() {
  let role = await Role.findOne({ role_name: "Shop Owner" });
  if (!role) {
    role = await Role.create({
      role_name: "Shop Owner",
      description: "Chủ shop — toàn quyền quản lý shop",
      category: "system",
      scope: "shop",
      type: "system",
      permissions: [
        { module: "shop", actions: ["view", "create", "update", "delete"] },
        { module: "user", actions: ["view", "create", "update", "delete"] },
        { module: "campaign", actions: ["view", "create", "update", "delete"] },
        { module: "ads", actions: ["view", "create", "update", "delete"] },
        { module: "analytics", actions: ["view"] },
        { module: "automation", actions: ["view", "create", "update", "delete"] },
        { module: "payment", actions: ["view", "create"] },
      ],
    });
  }
  return role._id;
}

export async function createDefaultShopAndRole(user) {
  const shop = await Shop.create({
    shop_name: user.full_name,
    owner_id: user._id,
    status: "active",
    settings: {
      currency: "VND",
      timezone: "Asia/Ho_Chi_Minh",
      language: "vi",
    },
    created_by: user._id,
    updated_by: user._id,
  });

  const shopUser = await ShopUser.create({
    user_id: user._id,
    shop_id: shop._id,
    is_manager: true,
    status: "active",
  });

  const ownerRoleId = await getOrCreateShopOwnerRole();

  await UserRole.create({
    user_id: user._id,
    role_id: ownerRoleId,
    shop_id: shop._id,
    shop_user_id: shopUser._id,
    is_current: true,
  });

  return { shop, shopUser };
}
