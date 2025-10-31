import ShopUser from "../models/shopUser.model.js";

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

// Lấy danh sách tất cả ShopUser
export const getShopUsers = async (req, res) => {
  try {
    const shopUsers = await ShopUser.find()
      .populate("shop_id", "shop_name status")
      .populate("user_id", "name email");
    res.json(shopUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
