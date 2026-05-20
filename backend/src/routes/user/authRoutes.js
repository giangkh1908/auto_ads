import express from "express";
import {
  register,
  login,
  facebookLogin,
  linkFacebook,
  verifyEmail,
  forgotPassword,
  resetPassword,
  refreshToken,
  resendVerificationEmail,
  getCurrentUser,
  updateProfile,
  logout,
  changePassword,
} from "../../controllers/user/authControllers.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { loginLimiter, registerLimiter, forgotPasswordLimiter, resendMailLimiter } from "../../middlewares/rateLimiter.js";

const router = express.Router();

// 🧾 Auth routes
router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/facebook", facebookLogin);
router.post("/facebook/link", authenticate, linkFacebook);
router.get("/verify/:token", verifyEmail);

//Route xác nhận email
router.get("/verify-email/:token", verifyEmail);
router.post("/resend-verification", resendMailLimiter, resendVerificationEmail);

// 🔁 Token refresh + logout
router.post("/refresh", refreshToken);
router.post("/logout", authenticate, logout);

// 🧠 Password management
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/reset-password/:token", resetPassword);

// 👤 Profile
router.get("/me", authenticate, getCurrentUser);
router.put("/me", authenticate, updateProfile);

// 🔑 Change Password
router.post("/change-password", authenticate, changePassword);

export default router;
