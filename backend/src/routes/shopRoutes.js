import express from "express";
import { 
    createShop, 
    getShops, 
    getMyShops,
    getShopById, 
    updateShop, 
    deleteShop, 
    getFacebookPages, 
    connectFacebookPage, 
    disconnectFacebookPage, 
    refreshFacebookToken 
} from "../controllers/shopControllers.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/my-shops", authenticate, getMyShops);
router.get("/facebook/pages", authenticate, getFacebookPages);
router.get("/", getShops);
router.get("/:id", getShopById);

router.post("/", createShop);

router.put("/:id", updateShop);

router.delete("/:id", deleteShop);

// Facebook integration helpers
router.post("/facebook/connect", authenticate, connectFacebookPage);
router.post("/facebook/disconnect", authenticate, disconnectFacebookPage);
router.post("/facebook/refresh-token", authenticate, refreshFacebookToken);

export default router;