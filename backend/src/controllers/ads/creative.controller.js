import Creative from "../../models/ads/creative.model.js";

// Helper function to extract string ID from ObjectId format
function extractObjectId(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = value.match(/[0-9a-fA-F]{24}/);
    return match ? match[0] : null;
  }
  if (value.$oid) return value.$oid; // If MongoDB exports as { $oid: '...' }
  return value.toString();
}

/**
 * GET /api/creatives/database
 * Get creative from database by creative_id
 */
export async function getCreativeFromDatabase(req, res) {
  try {
    const { creative_id } = req.query;
    
    if (!creative_id) {
      return res.status(400).json({
        success: false,
        message: "Thiếu creative_id"
      });
    }

    // Extract and validate creative_id
    const cleanCreativeId = extractObjectId(creative_id);
    if (!cleanCreativeId) {
      return res.status(400).json({
        success: false,
        message: "creative_id không hợp lệ"
      });
    }

    const creative = await Creative.findById(cleanCreativeId);
    
    if (!creative) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy creative"
      });
    }

    return res.status(200).json({
      success: true,
      data: creative
    });
  } catch (err) {
    console.error("GET Creative from database error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy creative từ database",
      error: err.message
    });
  }
}

/**
 * GET /api/creatives
 * Get list of creatives
 */
export async function listCreativesCtrl(req, res) {
  try {
    const { page = 1, limit = 10, q } = req.query;

    // Build filter
    const filter = {};
    if (q) filter.name = new RegExp(q, "i");

    // Get data with pagination
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Creative.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Creative.countDocuments(filter),
    ]);

    return res.status(200).json({
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)) || 1,
    });
  } catch (err) {
    console.error("GET Creatives error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách creatives",
      error: err.message
    });
  }
}
