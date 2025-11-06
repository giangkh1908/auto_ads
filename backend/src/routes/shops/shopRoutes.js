import express from "express";
import { 
    createShop, 
    getShops, 
    getShopById, 
    getShopsByOwner,
    updateShop, 
    deleteShop, 
    activateShop, 
    deactivateShop,
    switchCurrentShop,
    getFacebookPages, 
    connectFacebookPage, 
    disconnectFacebookPage, 
    refreshFacebookToken 
} from "../../controllers/shops/shopControllers.js";
import { authenticate, authorizeInShop } from "../../middlewares/auth.middleware.js";

const router = express.Router();
router.use(authenticate);

router.get("/", getShops);
router.get("/facebook/pages", getFacebookPages);
router.get("/owner", getShopsByOwner);
router.get("/:id", getShopById);

router.post("/", createShop);

router.put("/:id", authorizeInShop("shop", "update_details"), updateShop);

// router.delete("/:id", deleteShop);

router.patch("/switch/:id", authorizeInShop("shop", "change_active"), switchCurrentShop);

// router.patch("/:id/activate", authorizeInShop("shop", "activate"), activateShop);

// router.patch("/:id/deactivate", authorizeInShop("shop", "deactivate"), deactivateShop);

// Facebook integration helpers
router.post("/facebook/connect", authenticate, connectFacebookPage);
router.post("/facebook/disconnect", authenticate, disconnectFacebookPage);
router.post("/facebook/refresh-token", authenticate, refreshFacebookToken);

export default router;