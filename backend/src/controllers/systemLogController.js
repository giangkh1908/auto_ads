// backend/src/controllers/systemLogController.js
import SystemLog from '../models/systemLogs.model.js';

/**
 * Lấy danh sách system logs với filters
 * Chỉ System Admin mới có quyền truy cập
 */
export const getSystemLogs = async (req, res) => {
  try {
    // Kiểm tra quyền System Admin
    if (req.user.internal_role !== 'System Admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ System Admin mới có quyền xem System Logs.',
      });
    }

    // Parse query params
    const {
      role = 'All',
      category,
      level,
      action,
      success,
      search = '',
      startDate,
      endDate,
      page = 1,
      limit = 100,
    } = req.query;

    // Parse date range từ frontend format "dd/mm/yyyy - dd/mm/yyyy"
    let parsedStartDate = null;
    let parsedEndDate = null;

    if (startDate) {
      parsedStartDate = new Date(startDate);
    }
    if (endDate) {
      parsedEndDate = new Date(endDate);
      // Set time to end of day
      parsedEndDate.setHours(23, 59, 59, 999);
    }

    // Build filters
    const filters = {
      internal_role: role,
      category: category || undefined,
      level: level || undefined,
      action: action || undefined,
      success: success !== undefined ? success === 'true' : undefined,
      search: search.trim() || undefined,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
    };

    // Query logs
    const { data, total } = await SystemLog.findByFilters(filters);

    // Format response
    const formattedLogs = data.map(log => ({
      _id: log._id,
      user: log.user_name || 'Hệ thống',
      role: log.internal_role || 'System',
      time: log.created_at,
      event: log.description,
      action: log.action,
      category: log.category,
      level: log.level,
      success: log.success,
      target_type: log.target_type,
      target_name: log.target_name,
    }));

    res.status(200).json({
      success: true,
      data: formattedLogs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('❌ Get system logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi lấy system logs.',
      error: error.message,
    });
  }
};
