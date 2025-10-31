import express from "express";
import { createShopUser, getShopUsers, getShopUserById, updateShopUser, deleteShopUser } from "../controllers/shopUserControllers.js";

const router = express.Router();

router.get("/", getShopUsers);

router.get("/:id", getShopUserById);

router.post("/", createShopUser);

router.put("/:id", updateShopUser);

router.delete("/:id", deleteShopUser);

export default router;