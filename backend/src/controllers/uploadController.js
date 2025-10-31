// controllers/upload.controller.js
import cloudinary from "../config/cloudinary.js";

/**
 * Upload image to Cloudinary
 * @param {*} req
 * @param {*} res
 */
export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Không có file nào được tải lên.",
      });
    }

    const filePath = req.file.path;

    // Upload lên Cloudinary
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "ads_creatives", // folder riêng cho quảng cáo
      resource_type: "image",
      transformation: [
        { quality: "auto" },
        { fetch_format: "auto" },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Upload thành công.",
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (error) {
    console.error("❌ Upload image error:", error);
    return res.status(500).json({
      success: false,
      message: "Upload thất bại.",
      detail: error?.message,
    });
  }
};

/**
 * Upload video to Cloudinary
 * Accepts common video formats (mp4, mov, avi, webm, etc.)
 */
export const uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Không có file nào được tải lên.",
      });
    }

    const filePath = req.file.path;

    // Upload video lên Cloudinary
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "ads_creatives",
      resource_type: "video",
      // Note: Transformations for video can be heavy; keep defaults unless needed
    });

    return res.status(200).json({
      success: true,
      message: "Upload video thành công.",
      url: result.secure_url,
      public_id: result.public_id,
      duration: result.duration,
      format: result.format,
      bytes: result.bytes,
    });
  } catch (error) {
    console.error("❌ Upload video error:", error);
    return res.status(500).json({
      success: false,
      message: "Upload video thất bại.",
      detail: error?.message,
    });
  }
};

/**
 * Generic upload for both images and videos using resource_type: 'auto'
 * Can be used if you prefer one endpoint for all files
 */
export const uploadMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Không có file nào được tải lên.",
      });
    }

    const filePath = req.file.path;
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "ads_creatives",
      resource_type: "auto",
    });

    return res.status(200).json({
      success: true,
      message: "Upload thành công.",
      url: result.secure_url,
      public_id: result.public_id,
      resource_type: result.resource_type,
      format: result.format,
      bytes: result.bytes,
      duration: result.duration,
    });
  } catch (error) {
    console.error("❌ Upload media error:", error);
    return res.status(500).json({
      success: false,
      message: "Upload thất bại.",
      detail: error?.message,
    });
  }
};