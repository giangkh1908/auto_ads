import Shop from "../../models/shops/shop.model.js";
import User from "../../models/user.model.js";
import fetch from "node-fetch";
import Log from "../../models/log.model.js";
import UserRole from "../../models/userRole.model.js";
import ShopUser from "../../models/shops/shopUser.model.js";
import Role from "../../models/role.model.js";
import { saveLog } from "../../utils/log.js";
import UserPackage from "../../models/userPackage.model.js";

//  Tạo Shop
export const createShop = async (req, res) => {
  try {
    if (!req.body.shop_name) {
      return res.status(400).json({ message: "Shop name is required" });
    }
    if (!req.body.industry) {
      return res.status(400).json({ message: "Category is required" });
    }
    // Tìm role "Shop Owner" thay vì fix cứng _id
    const ownerRole = await Role.findOne({ role_name: "Shop Owner" });
    if (!ownerRole) {
      return res.status(404).json({
        success: false,
        message: "Role 'Shop Owner' không tồn tại trong hệ thống.",
      });
    }
    const ownerId = req.user._id;
    const currentUser = await User.findById(ownerId);
    // Kiểm tra xem user đã có shop trùng tên chưa
    const existingShop = await Shop.findOne({
      owner_id: ownerId,
      shop_name: { $regex: new RegExp(`^${req.body.shop_name}$`, "i") }, // không phân biệt hoa thường
    });

    if (existingShop) {
      return res.status(400).json({
        success: false,
        message: `Bạn đã có một cửa hàng tên "${existingShop.shop_name}" rồi.`,
      });
    }

    // KIỂM TRA GÓI HIỆN TẠI
    const userPackage = await UserPackage.findOne({
      user_id: ownerId,
      status: "active",
    }).populate("package_id");

    if (!userPackage) {
      return res.status(403).json({
        success: false,
        message: "Bạn cần có gói dịch vụ để tạo shop",
      });
    }

    // LẤY LIMIT TỪ UserPackage (có thể mua thêm)
    const shopLimit = userPackage.shops || 0;

    // ĐẾM SỐ SHOP HIỆN TẠI (usage thực tế)
    const currentShopCount = await Shop.countDocuments({
      ownerId,
      deleted_at: null,
    });

    // KIỂM TRA GIỚI HẠN
    if (currentShopCount >= shopLimit) {
      return res.status(403).json({
        success: false,
        message: `Đã đạt giới hạn shop: ${currentShopCount}/${shopLimit}`,
      });
    }

    const shop = new Shop({ ...req.body, owner_id: ownerId });
    await shop.save();
    const userRole = new UserRole({
      user_id: ownerId,
      shop_id: shop._id,
      role_id: ownerRole._id,
    });
    await userRole.save();
    const shopUser = new ShopUser({
      shop_id: shop._id,
      user_id: ownerId,
    });
    await shopUser.save();
    res.status(201).json({
      success: true,
      message: "Shop created successfully",
      shop,
    });
    console.log("Creating shop:", req.body);
    await saveLog({
      user_id: ownerId,
      user_name: currentUser.full_name || currentUser.email,
      shop_id: shop._id,
      shop_name: shop.shop_name,
      action: "CREATE_SHOP",
      target_type: "Shop",
      target_id: shop._id.toString(),
      target_name: shop.shop_name,
      request: req.body,
      response: shop,
      ip_address: req.ip,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

//  Lấy tất cả Shop
export const getShops = async (req, res) => {
  try {
    const shops = await Shop.find()
      .populate("owner_id", "name email")
      .populate("salesman_id", "name email");
    res.json(shops);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//  Lấy Shop theo ID
export const getShopById = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id)
      .populate("owner_id", "name email")
      .populate("salesman_id", "name email");
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    res.json(shop);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Lấy tất cả shop theo owner_id
export const getShopsByOwner = async (req, res) => {
  try {
    const userId = req.user._id;

    // Lấy danh sách role của user trong các shop
    const userRoles = await UserRole.find({ user_id: userId })
      .populate("role_id", "role_name permissions")
      .select("shop_id role_id is_current");

    if (!userRoles.length) {
      return res.status(403).json({
        success: false,
        message: "User must have at least one role in a shop.",
      });
    }

    // Lấy danh sách shop_id mà user có quyền
    const shopIds = userRoles.map((ur) => ur.shop_id);

    // Lấy thông tin chi tiết của các shop
    const shops = await Shop.find({ _id: { $in: shopIds } })
      .populate({
        path: "owner_id",
        select: "full_name email phone",
      })
      .populate({
        path: "user_roles",
        populate: { path: "role_id", select: "role_name" },
      });

    // 👉 Đếm số lượng employee trong mỗi shop (từ bảng ShopUser)
    const shopEmployeesCount = await Promise.all(
      shops.map(async (shop) => {
        const count = await ShopUser.countDocuments({
          shop_id: shop._id,
          status: "active", // chỉ tính nhân viên đang hoạt động
        });
        return { shop_id: shop._id.toString(), employee_count: count };
      })
    );

    // Gắn role tương ứng và employee_count vào từng shop
    const shopsWithUserRole = shops.map((shop) => {
      const roleEntry = userRoles.find(
        (ur) => ur.shop_id.toString() === shop._id.toString()
      );

      const employeeInfo = shopEmployeesCount.find(
        (item) => item.shop_id === shop._id.toString()
      );

      // Đếm số lượng page đang connected trong facebook_pages
      const pageCount = Array.isArray(shop.facebook_pages)
        ? shop.facebook_pages.filter((p) => p.connected_status === "connected")
          .length
        : 0;

      return {
        ...shop.toObject(),
        user_role: roleEntry.role_id,
        is_current: roleEntry.is_current,
        employee_count: employeeInfo?.employee_count || 0,
        page_count: pageCount,
      };
    });

    return res.status(200).json({
      success: true,
      data: shopsWithUserRole,
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách shop theo owner:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy danh sách shop.",
      error: error.message,
    });
  }
};

//  Update Shop
export const updateShop = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedShop = await Shop.findByIdAndUpdate(id, req.body, {
      new: true, // trả về bản ghi đã cập nhật
      runValidators: true,
    });
    if (!updatedShop) return res.status(404).json({ message: "Shop not found" });
    res.status(200).json({
      success: true,
      message: "Shop updated successfully",
      data: updatedShop,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Chuyển đổi shop hiện tại cho người dùng
export const switchCurrentShop = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const targetRole = await UserRole.findOne({ user_id: userId, shop_id: id });
    if (!targetRole) {
      return res.status(404).json({ success: false, message: "User not part of this shop" });
    }

    // Cập nhật: chỉ 1 shop được active
    await UserRole.updateMany({ user_id: userId }, { $set: { is_current: false } });
    targetRole.is_current = true;
    await targetRole.save();

    res.json({ success: true, message: "Current shop switched successfully" });
  } catch (err) {
    console.error("Error switching shop:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

//  Delete (xóa mềm)
export const deleteShop = async (req, res) => {
  try {
    const shop = await Shop.findByIdAndUpdate(
      req.params.id,
      { deleted_at: new Date() },
      { new: true }
    );
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    res.json({ message: "Shop đã xóa tạm thời", shop });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Kích hoạt Shop
export const activateShop = async (req, res) => {
  try {
    const { id } = req.params;

    const shop = await Shop.findByIdAndUpdate(
      id,
      { status: "active", updated_by: req.user?._id || null },
      { new: true }
    );

    if (!shop) return res.status(404).json({ message: "Shop không tồn tại" });

    res.json({ success: true, message: "Shop đã được kích hoạt", data: shop });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Vô hiệu hóa Shop
export const deactivateShop = async (req, res) => {
  try {
    const { id } = req.params;

    const shop = await Shop.findByIdAndUpdate(
      id,
      { status: "inactive", updated_by: req.user?._id || null },
      { new: true }
    );

    if (!shop) return res.status(404).json({ message: "Shop không tồn tại" });

    res.json({ success: true, message: "Shop đã bị vô hiệu hóa", data: shop });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getShopLogs = async (req, res) => {
  try {
    const userId = req.user._id;

    // Lấy shop hiện tại của user
    const currentRole = await UserRole.findOne({
      user_id: userId,
      is_current: true,
    }).lean();

    if (!currentRole) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy shop hiện tại của người dùng.",
      });
    }

    const shopId = currentRole.shop_id;

    // Lấy log của shop đó
    const logs = await Log.find({ shop_id: shopId })
      .populate("user_id", "full_name email")
      .sort({ created_at: -1 }) // mới nhất trước
      .limit(100);

    return res.status(200).json({
      success: true,
      data: logs, shopId,
    });
  } catch (error) {
    console.error("Lỗi getShopLogs:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy log.",
      error: error.message,
    });
  }
};

// Lấy danh sách trang Facebook từ access token đã lưu (người dùng hiện tại)
export const getFacebookPages = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+facebookAccessToken');
    if (!user?.facebookAccessToken) {
      return res.status(400).json({ success: false, message: 'Không có Facebook access token. Vui lòng đăng nhập Facebook.' });
    }

    const fbResp = await fetch(`https://graph.facebook.com/me/accounts?fields=id,name,category,access_token,tasks,picture.width(200).height(200){url}&access_token=${user.facebookAccessToken}`);
    const fbData = await fbResp.json();
    if (!fbData?.data) {
      return res.status(400).json({ success: false, message: 'Không lấy được danh sách page từ Facebook', detail: fbData });
    }

    const pages = fbData.data.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      pageAccessToken: p.access_token,
      tasks: p.tasks || [],
      picture: p.picture?.data?.url || null,
    }));

    return res.status(200).json({ success: true, data: { pages } });
  } catch (error) {
    console.error('getFacebookPages error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống.' });
  }
};

// Kết nối page vào shop: lưu facebook_page_id và facebook_page_token
export const connectFacebookPage = async (req, res) => {
  try {
    const { pageId, pageAccessToken } = req.body;
    const userId = req.user._id;
    const currentUser = await User.findById(userId);
    if (!pageId || !pageAccessToken) {
      return res.status(400).json({ success: false, message: 'Thiếu tham số.' });
    }

    // Xác định shop hiện tại qua UserRole (is_current = true)
    const currentRole = await UserRole.findOne({
      user_id: userId,
      is_current: true,
      revoked_at: null,
    }).lean();

    if (!currentRole) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy vai trò hiện tại của người dùng.",
      });
    }

    const shopId = currentRole.shop_id;

    // Lấy data page hiển thị lên dashboard
    let pageInfo = null;
    try {
      const infoResp = await fetch(`https://graph.facebook.com/${pageId}?fields=id,name,category,link,picture.width(200).height(200){url}&access_token=${pageAccessToken}`);
      const infoData = await infoResp.json();
      if (infoData && !infoData.error) {
        pageInfo = {
          name: infoData.name,
          category: infoData.category,
          link: infoData.link,
          picture_url: infoData?.picture?.data?.url || null,
        };
      }
    } catch { }

    // Tìm shop và upsert vào mảng facebook_pages
    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop không tồn tại.' });

    const idx = (shop.facebook_pages || []).findIndex(p => p.page_id === pageId);
    const newEntry = {
      page_id: pageId,
      page_token: pageAccessToken,
      connected_status: 'connected',
      ...(pageInfo ? { page_info: pageInfo } : {}),
      connected_at: new Date(),
      last_synced_at: null,
    };

    if (idx >= 0) {
      shop.facebook_pages[idx] = { ...shop.facebook_pages[idx].toObject?.() || shop.facebook_pages[idx], ...newEntry };
    } else {
      shop.facebook_pages.push(newEntry);
    }

    await shop.save();

    // Cập nhật ShopUser bằng findOneAndUpdate (tránh VersionError)
    const updatedShopUser = await ShopUser.findOneAndUpdate(
      { user_id: userId, shop_id: shopId, removed_at: null },
      [
        {
          $set: {
            facebook_pages: {
              $let: {
                vars: {
                  pages: {
                    $ifNull: ["$facebook_pages", []],
                  },
                },
                in: {
                  $cond: [
                    { $in: [pageId, { $map: { input: "$$pages", as: "p", in: "$$p.page_id" } }] },
                    {
                      $map: {
                        input: "$$pages",
                        as: "p",
                        in: {
                          $cond: [
                            { $eq: ["$$p.page_id", pageId] },
                            { ...newEntry },
                            "$$p",
                          ],
                        },
                      },
                    },
                    { $concatArrays: ["$$pages", [newEntry]] },
                  ],
                },
              },
            },
          },
        },
      ],
      { new: true }
    );

    await saveLog({
      user_id: userId,
      user_name: currentUser.full_name || currentUser.email,
      shop_id: shopId,
      shop_name: shop.shop_name,
      action: "CONNECT_FACEBOOK_PAGE",
      target_type: "FacebookPage",
      target_id: pageId,
      target_name: pageInfo?.name || pageId,
      page_info: pageInfo,
      request: { pageId },
      response: { 
        success: true, 
        pageId, 
        pageName: pageInfo?.name,
        connectedPagesCount: shop.facebook_pages.length 
      },
      ip_address: req.ip,
    });

    return res.status(200).json({ success: true, message: 'Kết nối page thành công.', data: { shop, shopUser: updatedShopUser } });
  } catch (error) {
    console.error('connectFacebookPage error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống.' });
  }
};

// Ngắt kết nối page khỏi shop (đặt connected_status = 'disconnected' và xoá token)
export const disconnectFacebookPage = async (req, res) => {
  try {
    const { pageId } = req.body;
    if (!pageId) {
      return res.status(400).json({ success: false, message: 'Thiếu tham số.' });
    }
    const userId = req.user._id;
    const currentUser = await User.findById(userId);

    // Lấy shop hiện tại của user
    const currentUserRole = await UserRole.findOne({
      user_id: userId,
      is_current: true,
    });

    if (!currentUserRole) {
      return res.status(404).json({ success: false, message: "Không tìm thấy vai trò hiện tại của người dùng." });
    }

    const shopId = currentUserRole.shop_id;

    // Tìm ShopUser tương ứng với người dùng hiện tại trong shop đó
    const shopUser = await ShopUser.findOne({
      user_id: userId,
      shop_id: shopId,
      removed_at: null,
    });

    if (!shopUser) {
      return res.status(404).json({ success: false, message: "Không tìm thấy ShopUser tương ứng." });
    }
    console.log(String(shopUser._id).trim());

    // Xóa phần tử theo page_id để không phụ thuộc index (mảng tự co lại)
    await Promise.all([
      Shop.updateOne(
        { _id: shopId },
        { $pull: { facebook_pages: { page_id: pageId } } }
      ),
      ShopUser.updateOne(
        { _id: String(shopUser._id).trim() },
        { $pull: { facebook_pages: { page_id: pageId } } }
      ),
    ]);

    const updatedShop = await Shop.findById(shopId);
    const updatedShopUser = await ShopUser.findById(shopUser._id);

    await saveLog({
      user_id: userId,
      user_name: currentUser.full_name || currentUser.email,
      shop_id: shopId,
      shop_name: updatedShop?.shop_name || "Shop",
      action: "DISCONNECT_FACEBOOK_PAGE",
      target_type: "FacebookPage",
      target_id: pageId,
      target_name: pageId,
      request: req.body,
      success: true,
      ip_address: req.ip,
    });

    return res.status(200).json({ success: true, message: 'Đã ngắt kết nối page.', data: { shop: updatedShop, shopUser: updatedShopUser, } });
  } catch (error) {
    console.log('disconnectFacebookPage error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống.' });
  }
};

// Làm mới token Facebook
export const refreshFacebookToken = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+facebookAccessToken');
    if (!user?.facebookAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy Facebook access token. Vui lòng đăng nhập lại Facebook.'
      });
    }

    // Đổi token ngắn hạn thành token dài hạn (long-lived)
    const appId = process.env.FB_APP_ID;
    const appSecret = process.env.FB_APP_SECRET;

    if (!appId || !appSecret) {
      console.error('Missing FB_APP_ID or FB_APP_SECRET in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Cấu hình Facebook App chưa đầy đủ. Vui lòng kiểm tra FB_APP_ID và FB_APP_SECRET.'
      });
    }

    console.log('Attempting to refresh Facebook token...');
    const refreshUrl = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${user.facebookAccessToken}`;

    console.log('Refresh URL:', refreshUrl.replace(appSecret, '***SECRET***'));

    const fbResp = await fetch(refreshUrl);
    const fbData = await fbResp.json();

    console.log('Facebook refresh response:', fbData);

    if (fbData.error) {
      console.error('Facebook token refresh error:', fbData.error);
      return res.status(400).json({
        success: false,
        message: `Không thể làm mới access token: ${fbData.error.message || 'Token đã hết hạn'}`,
        detail: fbData.error
      });
    }

    if (!fbData.access_token) {
      console.error('No access_token in response:', fbData);
      return res.status(400).json({
        success: false,
        message: 'Facebook không trả về access token mới.'
      });
    }

    // Cập nhật token mới vào DB
    user.facebookAccessToken = fbData.access_token;
    await user.save();

    console.log('Facebook token refreshed successfully');
    return res.status(200).json({
      success: true,
      message: 'Làm mới access token thành công.',
      data: { accessToken: fbData.access_token }
    });
  } catch (error) {
    console.error('refreshFacebookToken system error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi làm mới access token.'
    });
  }
};