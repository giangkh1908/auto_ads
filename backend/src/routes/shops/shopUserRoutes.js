import express from "express";
import { createShopUser, getShopUsers, getUsersByShop, updateUserRole, updateUserStatus, relinquishOwnership, deleteShopUser } from "../../controllers/shops/shopUserControllers.js";
import { authenticate, authorizeInShop } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", getShopUsers);

router.get("/:shopId", getUsersByShop);

router.post("/", createShopUser);

router.put("/status/:shopId", updateUserStatus);

router.put("/relinquish", authenticate,  relinquishOwnership);

router.put("/:shopId", updateUserRole);

// router.delete("/:id", deleteShopUser);

export default router;