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

const router = express.Router();

router.get("/", getUserPackages);
router.get("/me/package", authenticate, getMyPackage);
router.post("/package", createUserPackage);
router.post("/order", authenticate, createOrder);

export default router;