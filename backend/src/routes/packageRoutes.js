import express from "express";
import {
    getPackages,
    createPackage,
    updatePackage,
    deletePackage,
} from "../controllers/packageControllers.js"
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", getPackages); // ?planType=3months
router.post("/", authenticate, createPackage);
router.put("/:id", authenticate, updatePackage);
router.delete("/:id", authenticate, deletePackage);

export default router;