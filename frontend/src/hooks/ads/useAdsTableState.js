import { useState, useEffect, useMemo, useRef } from "react";
import { getFilteredRows } from "../../services/ads/adsDataService";
import { useDebounce } from "../common/useDebounce";

/**
 * Parse dateRange string (DD/MM/YYYY - DD/MM/YYYY) to { dateFrom, dateTo } in ISO format
 * @param {string} dateRange - Date range string like "01/12/2024 - 31/12/2024"
 * @returns {{ dateFrom: string | null, dateTo: string | null }}
 */
export function parseDateRange(dateRange) {
  if (!dateRange || typeof dateRange !== 'string') {
    return { dateFrom: null, dateTo: null };
  }

  const parts = dateRange.split(' - ');
  if (parts.length !== 2) {
    return { dateFrom: null, dateTo: null };
  }

  const parseDate = (dateStr) => {
    // Handle DD/MM/YYYY format
    const match = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    // Handle YYYY-MM-DD format (already ISO)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
      return dateStr.trim();
    }
    return null;
  };

  return {
    dateFrom: parseDate(parts[0]),
    dateTo: parseDate(parts[1])
  };
}

/**
 * Filter items by name (case-insensitive search)
 * @param {Array} items - Array of items to filter
 * @param {string} searchTerm - Search term
 * @returns {Array} - Filtered items
 */
export function filterBySearchTerm(items, searchTerm) {
  if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim() === '') {
    return items;
  }
  
  const term = searchTerm.toLowerCase().trim();
  return items.filter(item => {
    const name = (item.name || '').toLowerCase();
    return name.includes(term);
  });
}

/**
 * Filter items by start_time date range (client-side)
 * Falls back to created_at if start_time is not available
 * @param {Array} items - Array of items to filter
 * @param {string} dateFrom - Start date in ISO format (YYYY-MM-DD)
 * @param {string} dateTo - End date in ISO format (YYYY-MM-DD)
 * @returns {Array} - Filtered items
 */
export function filterByDateRange(items, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) {
    return items;
  }
  
  const fromDate = dateFrom ? new Date(dateFrom) : null;
  const toDate = dateTo ? new Date(dateTo) : null;
  
  // Set toDate to end of day
  if (toDate) {
    toDate.setHours(23, 59, 59, 999);
  }
  
  return items.filter(item => {
    // Ưu tiên start_time, fallback sang created_at nếu không có
    const dateValue = item.start_time || item.created_at || item.createdAt;
    const itemDate = new Date(dateValue);
    if (isNaN(itemDate.getTime())) return true; // Keep items without valid date
    
    if (fromDate && itemDate < fromDate) return false;
    if (toDate && itemDate > toDate) return false;
    return true;
  });
}

/**
 * Custom hook to manage table state
 * Handles pagination, filtering, sorting, and search
 */
export function useAdsTableState(datasets, activeTab, selectedCampaign, selectedAdset) {
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState("");
  
  // Debounce search term (500ms) để tránh lag khi gõ
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  
  // Use ref to track previous values to avoid infinite loops
  const prevLimitRef = useRef(pagination.limit);
  const prevActiveTabRef = useRef(activeTab);

  // Get filtered and sorted rows (base filter by tab, selection, status)
  const baseFilteredRows = useMemo(() => {
    return getFilteredRows(datasets, activeTab, selectedCampaign, selectedAdset);
  }, [datasets, activeTab, selectedCampaign, selectedAdset]);

  // Apply search and date filters (client-side)
  const filteredRows = useMemo(() => {
    let result = baseFilteredRows;
    
    // Filter by search term (name) - sử dụng debounced value
    if (debouncedSearchTerm && debouncedSearchTerm.trim()) {
      result = filterBySearchTerm(result, debouncedSearchTerm);
    }
    
    // Filter by date range (created_at)
    const { dateFrom, dateTo } = parseDateRange(dateRange);
    if (dateFrom || dateTo) {
      result = filterByDateRange(result, dateFrom, dateTo);
    }
    
    return result;
  }, [baseFilteredRows, debouncedSearchTerm, dateRange]);

  // Update pagination when filtered rows change
  useEffect(() => {
    const total = filteredRows.length;
    const totalPages = Math.ceil(total / pagination.limit) || 1;
    
    setPagination(prev => ({
      ...prev,
      total,
      totalPages,
      // Reset to page 1 if current page is out of bounds
      page: prev.page > totalPages ? 1 : prev.page
    }));
  }, [filteredRows.length, pagination.limit]);

  // Reset page when tab changes
  useEffect(() => {
    if (prevActiveTabRef.current !== activeTab) {
      prevActiveTabRef.current = activeTab;
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  }, [activeTab]);

  // Reset page when search or date filter changes
  const prevSearchRef = useRef(debouncedSearchTerm);
  const prevDateRangeRef = useRef(dateRange);
  
  useEffect(() => {
    if (prevSearchRef.current !== debouncedSearchTerm || prevDateRangeRef.current !== dateRange) {
      prevSearchRef.current = debouncedSearchTerm;
      prevDateRangeRef.current = dateRange;
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  }, [debouncedSearchTerm, dateRange]);

  // Get paginated rows
  const rows = useMemo(() => {
    const startIndex = (pagination.page - 1) * pagination.limit;
    const endIndex = startIndex + pagination.limit;
    return filteredRows.slice(startIndex, endIndex);
  }, [filteredRows, pagination.page, pagination.limit]);

  const handlePageChange = (page) => {
    setPagination(prev => ({ ...prev, page }));
  };

  const handleItemsPerPageChange = (limit) => {
    prevLimitRef.current = limit;
    setPagination(prev => ({ ...prev, page: 1, limit }));
  };

  return {
    pagination,
    rows,
    searchTerm,
    setSearchTerm,
    dateRange,
    setDateRange,
    handlePageChange,
    handleItemsPerPageChange,
  };
}

