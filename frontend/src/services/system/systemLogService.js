// frontend/src/services/systemLogService.js
import axiosInstance from '../../utils/api/axios';
import { API_ENDPOINTS } from '../../config/api.config';

/**
 * System Log Service
 * Handles system log-related API calls
 */

/**
 * Parse date range from frontend format "dd/mm/yyyy - dd/mm/yyyy" to ISO format
 */
const parseDateRange = (dateRange) => {
  if (!dateRange || !dateRange.includes('-')) {
    return { startDate: null, endDate: null };
  }

  const [from, to] = dateRange.split('-').map((d) => d.trim());
  
  // Parse format: dd/mm/yyyy
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    
    const [day, month, year] = parts.map((p) => parseInt(p, 10));
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    
    // Create date in local timezone, set to start/end of day
    const date = new Date(year, month - 1, day);
    return date.toISOString();
  };

  return {
    startDate: parseDate(from) || null,
    endDate: parseDate(to) || null,
  };
};

/**
 * Get system logs with filters
 * @param {Object} filters - Filter options
 * @param {string} filters.role - Filter by role (All, System Admin, CS Staff, Accountant)
 * @param {string} filters.category - Filter by category (auth, admin, system, automation, etc.)
 * @param {string} filters.level - Filter by level (info, warning, error, success)
 * @param {string} filters.search - Search query (searches in description, user_name, target_name)
 * @param {string} filters.dateRange - Date range in format "dd/mm/yyyy - dd/mm/yyyy"
 * @param {number} filters.page - Page number (default: 1)
 * @param {number} filters.limit - Items per page (default: 100)
 * @returns {Promise<Object>} Response with logs and pagination info
 */
export const getSystemLogs = async (filters = {}) => {
  try {
    const {
      role = 'All',
      category,
      level,
      search = '',
      dateRange = '',
      page = 1,
      limit = 100,
    } = filters;

    // Parse date range
    const { startDate, endDate } = parseDateRange(dateRange);

    // Build query params
    const params = new URLSearchParams();
    if (role) params.append('role', role);
    if (category) params.append('category', category);
    if (level) params.append('level', level);
    if (search.trim()) params.append('search', search.trim());
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    params.append('page', page.toString());
    params.append('limit', limit.toString());

    const response = await axiosInstance.get(
      `${API_ENDPOINTS.LOGS.SYSTEM}?${params.toString()}`
    );

    return response.data;
  } catch (error) {
    console.error('Error fetching system logs:', error);
    throw error.response?.data || {
      success: false,
      message: 'Có lỗi xảy ra khi lấy system logs',
      error: error.message,
    };
  }
};
