import express from "express";
import { 
    createOrder,
    createUserPackage,
    deleteUserPackage,
    getUserPackageById,
    getUserPackages,
    getMyPackage,
    updateUserPackage,
} from "../../controllers/package/userPackageControllers.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { adminActionLogger } from "../../middlewares/adminActionLogger.middleware.js";

const router = express.Router();

// Route user thường (không log)
router.get("/me/package", authenticate, getMyPackage);
router.post("/order", authenticate, createOrder);

// Routes admin (có log)
router.use(authenticate);
router.use(adminActionLogger); // Log admin actions
router.get("/", getUserPackages);
router.get("/:id", getUserPackageById);
router.post("/package", createUserPackage);
router.put("/:id", updateUserPackage);
router.delete("/:id", deleteUserPackage);

export default router;