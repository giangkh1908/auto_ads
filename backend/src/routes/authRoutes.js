import express from "express";
import {
  register,
  login,
  facebookLogin,
  verifyEmail,
  forgotPassword,
  resetPassword,
  refreshToken,
  resendVerificationEmail,
  getCurrentUser,
  updateProfile,
  logout,
  changePassword,
} from "../controllers/authControllers.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

// 🧾 Auth routes
router.post("/register", register);
router.post("/login", login);
router.post("/facebook", facebookLogin);
router.get("/verify/:token", verifyEmail);

//Route xác nhận email
router.get("/verify-email/:token", verifyEmail);
router.post("/resend-verification", resendVerificationEmail);

// 🔁 Token refresh + logout
router.post("/refresh", refreshToken);
router.post("/logout", authenticate, logout);

// 🧠 Password management
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// 👤 Profile
router.get("/me", authenticate, getCurrentUser);
router.put("/me", authenticate, updateProfile);

// 🔑 Change Password
router.post("/change-password", authenticate, changePassword);

export default router;
