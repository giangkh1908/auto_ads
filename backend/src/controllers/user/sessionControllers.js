import UserSession from "../../models/user/userSession.model.js";
import redis from "../../config/redis.js";
import { saveSystemLog, getClientIp } from "../../utils/systemLog.js";

export const getSessions = async (req, res) => {
  try {
    const sessions = await UserSession.find({ user_id: req.user._id, isActive: true })
      .sort({ lastUsedAt: -1 })
      .select("-_id jti device isActive lastUsedAt created_at");

    res.json({ success: true, data: sessions });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách session." });
  }
};

export const revokeSession = async (req, res) => {
  try {
    const { jti } = req.params;
    const session = await UserSession.findOne({ jti, user_id: req.user._id });

    if (!session) {
      return res.status(404).json({ success: false, message: "Session không tồn tại." });
    }

    await UserSession.revokeByJti(jti);

    const refreshKey = `refresh:${jti}`;
    await redis.del(refreshKey);

    await saveSystemLog({
      category: "auth",
      level: "info",
      action: "SESSION_REVOKED",
      user_id: req.user._id,
      user_name: req.user.full_name,
      internal_role: req.user.internal_role,
      description: `Session ${jti.slice(0, 8)}... đã bị thu hồi`,
      ip_address: getClientIp(req),
      success: true,
    });

    res.json({ success: true, message: "Session đã bị thu hồi." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi thu hồi session." });
  }
};

export const revokeAllSessions = async (req, res) => {
  try {
    const currentJti = req.headers["x-current-jti"];

    await UserSession.revokeAllExcept(req.user._id, currentJti);

    await saveSystemLog({
      category: "auth",
      level: "info",
      action: "ALL_SESSIONS_REVOKED",
      user_id: req.user._id,
      user_name: req.user.full_name,
      internal_role: req.user.internal_role,
      description: "Tất cả session khác đã bị thu hồi",
      ip_address: getClientIp(req),
      success: true,
    });

    res.json({ success: true, message: "Tất cả session khác đã bị thu hồi." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi thu hồi sessions." });
  }
};
