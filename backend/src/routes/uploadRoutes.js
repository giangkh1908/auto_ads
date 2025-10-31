// routes/upload.routes.js
import express from "express";
import multer from "multer";
import { uploadImage, uploadVideo, uploadMedia } from "../controllers/uploadController.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Cấu hình multer (lưu tạm local trước khi gửi Cloudinary)
const storage = multer.diskStorage({});
const upload = multer({ storage });

/**
 * POST /api/upload/image
 * Upload ảnh quảng cáo (Creative)
 */
router.post("/image", authenticate, upload.single("file"), uploadImage);

/**
 * POST /api/upload/video
 * Upload video quảng cáo (Creative)
 */
router.post("/video", upload.single("file"), uploadVideo);

/**
 * POST /api/upload/media
 * Upload cả ảnh và video (tự nhận diện loại)
 */
router.post("/media", authenticate, upload.single("file"), uploadMedia);

export default router;
